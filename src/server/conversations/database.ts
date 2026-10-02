import "server-only";

export type ConversationSqlValue = string | number | bigint | null | Uint8Array;

export type ConversationSqlStatement = Readonly<{
  sql: string;
  args?: readonly ConversationSqlValue[];
}>;

export type ConversationSqlResult = Readonly<{
  rows: readonly Record<string, unknown>[];
  rowsAffected?: number;
}>;

export interface ConversationSqlExecutor {
  execute(statement: ConversationSqlStatement | string): Promise<ConversationSqlResult>;
  /** Ordered statements on this already-open transaction; never client.batch. */
  batch?(statements: readonly (ConversationSqlStatement | string)[]): Promise<readonly ConversationSqlResult[]>;
}

export async function executeConversationBatch(
  executor: ConversationSqlExecutor,
  statements: readonly (ConversationSqlStatement | string)[],
): Promise<readonly ConversationSqlResult[]> {
  if (statements.length === 0) return [];
  if (executor.batch) {
    const results = await executor.batch(statements);
    if (results.length !== statements.length || results.some(result => !result || !Array.isArray(result.rows))) {
      throw new Error("conversation_batch_results_invalid");
    }
    return results;
  }
  const results: ConversationSqlResult[] = [];
  for (const statement of statements) results.push(await executor.execute(statement));
  return results;
}

export interface ConversationTransactionalClient {
  transaction(mode: "read" | "write"): Promise<ConversationTransaction>;
  execute?(statement: ConversationSqlStatement | string): Promise<ConversationSqlResult>;
}

export interface ConversationTransaction extends ConversationSqlExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ConversationDatabaseAdapter {
  readonly available: boolean;
  readonly boundary: "remote-interactive-transaction" | "local-serialized-connection" | "unavailable";
  readonly unavailableReason?: string;
  /** Optional fresh one-statement read, exposed only by the remote adapter. */
  readStatement?(statement: ConversationSqlStatement | string): Promise<ConversationSqlResult>;
  transaction<T>(
    mode: "read" | "write",
    operation: (executor: ConversationSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

async function runInteractiveTransaction<T>(
  client: ConversationTransactionalClient,
  mode: "read" | "write",
  operation: (executor: ConversationSqlExecutor) => Promise<T>,
): Promise<T> {
  const transaction = await client.transaction(mode);
  try {
    const value = await operation(transaction);
    await transaction.commit();
    return value;
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

/**
 * Remote libSQL must expose its interactive transaction API. A caller cannot
 * substitute a client with execute-only HTTP semantics and accidentally make
 * the service's authorization and source writes separate requests.
 */
export function createRemoteConversationDatabaseAdapter(input: {
  client: ConversationTransactionalClient;
}): ConversationDatabaseAdapter {
  if (typeof input.client.transaction !== "function") {
    return createUnavailableConversationDatabaseAdapter("remote_transaction_unverified");
  }
  return {
    available: true,
    boundary: "remote-interactive-transaction",
    ...(input.client.execute ? { readStatement: (statement: ConversationSqlStatement | string) => input.client.execute!(statement) } : {}),
    transaction: (mode, operation) => runInteractiveTransaction(input.client, mode, operation),
  };
}

/**
 * The installed local libSQL driver has a persistent execute connection. Its
 * interactive native transaction handles were unstable under contention in
 * EX-01, so local operations share one explicit queue and one connection.
 */
export function createLocalConversationDatabaseAdapter(input: {
  client: Pick<ConversationSqlExecutor, "execute">;
}): ConversationDatabaseAdapter {
  let tail: Promise<void> = Promise.resolve();

  async function queued<T>(operation: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  return {
    available: true,
    boundary: "local-serialized-connection",
    transaction: (mode, operation) => queued(async () => {
      await input.client.execute(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN TRANSACTION");
      try {
        // A native client's batch starts its own transaction. Do not expose it
        // through this adapter's manually opened, serialized connection.
        const value = await operation({ execute: statement => input.client.execute(statement) });
        await input.client.execute("COMMIT");
        return value;
      } catch (error) {
        await input.client.execute("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }),
  };
}

export function createUnavailableConversationDatabaseAdapter(
  reason: string,
): ConversationDatabaseAdapter {
  return {
    available: false,
    boundary: "unavailable",
    unavailableReason: reason,
    async transaction() {
      throw new Error(`conversation_database_unavailable:${reason}`);
    },
  };
}
