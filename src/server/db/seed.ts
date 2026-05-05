import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  SEED_COMMENT_BODIES,
  SEED_TASKS,
  USERS,
  type UserId,
} from "@/lib/data";
import { comments, tasks, users } from "./schema";

type DbType = ReturnType<typeof drizzle<typeof import("./schema")>>;

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Idempotent seed. Runs in a transaction so partial failure leaves
 * the DB empty for a retry on next boot.
 */
export function seedIfEmpty(db: DbType): void {
  const existingTasks = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .all();
  const existingComments = db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .all();

  const tasksEmpty = (existingTasks[0]?.count ?? 0) === 0;
  const commentsEmpty = (existingComments[0]?.count ?? 0) === 0;

  if (!tasksEmpty && !commentsEmpty) return;

  const sqlite = (db.$client as unknown) as Database;
  const userIds: UserId[] = Object.keys(USERS) as UserId[];
  const now = Math.floor(Date.now() / 1000);

  const tx = sqlite.transaction(() => {
    if (tasksEmpty) {
      for (const u of Object.values(USERS)) {
        db.insert(users).values(u).run();
      }
      for (const t of SEED_TASKS) {
        db.insert(tasks).values(t).run();
      }
    }

    if (commentsEmpty) {
      for (const t of SEED_TASKS) {
        const baseHash = strHash(t.id);
        for (let offset = 0; offset < 3; offset++) {
          const seed = baseHash + offset * 31;
          const userId = pick(userIds, seed);
          const body = pick(SEED_COMMENT_BODIES, seed * 7 + offset);
          // Stagger so the order reads as a real conversation
          const createdAt = new Date((now - (3 - offset) * 3600) * 1000);
          db.insert(comments)
            .values({
              id: `c-${t.id}-${offset}`,
              taskId: t.id,
              userId,
              body,
              createdAt,
            })
            .run();
        }
      }
    }
  });
  tx();
}

// Allow `tsx src/server/db/seed.ts` for explicit re-seed.
if (require.main === module) {
  // Imported lazily to avoid circular boot.
  import("./index").then(({ db }) => {
    seedIfEmpty(db);
    // eslint-disable-next-line no-console
    console.log("seed: done");
  });
}
