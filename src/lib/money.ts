/**
 * Money, narrowly (T·124, board truth phase 5).
 *
 * The ratified boundary: Tasks may RESTATE a number the operator entered,
 * and SUM those numbers with honest coverage. It must never compute,
 * forecast, convert or publish a financial claim — no invoicing, no
 * payment status, no multi-currency arithmetic, and money never renders
 * on share, print, embed or /p/{slug} (the public projection has no cents
 * field, and the projection contract test keeps it that way).
 *
 * A project has ONE currency. It labels amounts; it never converts them.
 * Existing projects predate the column and keep the USD label their
 * amounts were entered under — relabelling stored numbers would change
 * the operator's claim, which the boundary forbids.
 */

export const DEFAULT_CURRENCY = "USD";

/** Curated ISO-4217 codes the settings select offers. A label, not a
 *  conversion table — adding one here adds a formatting choice only. */
export const PROJECT_CURRENCIES = [
  "EUR",
  "GBP",
  "USD",
  "AUD",
  "CAD",
  "NZD",
  "CHF",
  "SEK",
] as const;

export type ProjectCurrency = (typeof PROJECT_CURRENCIES)[number];

export function isProjectCurrency(value: unknown): value is ProjectCurrency {
  return (
    typeof value === "string" &&
    (PROJECT_CURRENCIES as readonly string[]).includes(value)
  );
}

/**
 * Format integer cents in the project's currency, code-first the way the
 * brief reads them ("EUR 18,400", "USD 1,200.50"). Whole amounts drop
 * the fraction; partial amounts keep both digits. The locale is pinned
 * so the server render and the client hydration agree byte-for-byte.
 */
export function formatCents(
  cents: number,
  currency: string | null | undefined,
): string {
  const code = isProjectCurrency(currency ?? "") ? (currency as string) : DEFAULT_CURRENCY;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: code,
    currencyDisplay: "code",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
    .format(cents / 100)
    // Intl separates code and amount with U+00A0; normalise so copy,
    // tests and grep all see the same plain-space sentence.
    .replace(/ /g, " ");
}

/**
 * The coverage-first roll-up sentence. Never a bare total: the reader
 * always sees how much of the board the number actually covers.
 */
export function budgetCoverageLine(input: {
  summedCents: number;
  costedCount: number;
  uncostedCount: number;
  budgetCents: number | null;
  currency: string | null;
}): string | null {
  const { summedCents, costedCount, uncostedCount, budgetCents, currency } = input;
  if (costedCount === 0 && budgetCents == null) return null;
  const spend = formatCents(summedCents, currency);
  const lead = budgetCents != null
    ? `${spend} of ${formatCents(budgetCents, currency)}.`
    : `${spend} recorded.`;
  const costed = `${costedCount} task${costedCount === 1 ? "" : "s"} costed`;
  const uncosted = uncostedCount > 0
    ? `, ${uncostedCount} without a price.`
    : ".";
  return `${lead} ${costed}${uncosted}`;
}
