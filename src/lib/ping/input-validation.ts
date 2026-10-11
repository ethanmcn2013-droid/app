/** Strict JSON-shaped values: no getters, symbols, exotic prototypes or implicit coercion. */
export function dataRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return false;
  return Reflect.ownKeys(value).every((key) => typeof key === "string" &&
    Object.getOwnPropertyDescriptor(value, key)?.enumerable === true &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, "value"));
}
export function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
export function jsonArray(value: unknown, maximum: number): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype &&
    value.length <= maximum && Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({ length: value.length }, (_, index) => Object.getOwnPropertyDescriptor(value, String(index)))
      .every((descriptor) => descriptor && Object.hasOwn(descriptor, "value"));
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function transcriptText(value: unknown, allowEmpty: boolean): value is string {
  return typeof value === "string" && value.length <= 8000 &&
    (allowEmpty || value.trim().length > 0) &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) &&
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}
export function codePoints(value: string): number { return Array.from(value).length; }
/** Exact canonical payload identity, NOT a cryptographic hash or authorization token. Only parsed values enter here. */
export function canonicalIdentity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIdentity).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalIdentity((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
