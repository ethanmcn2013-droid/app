export type SearchParamValue = string | string[] | undefined;
export type SearchParamsInput =
  | URLSearchParams
  | Readonly<Record<string, SearchParamValue>>;

export function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);

  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((item) => result.append(key, item));
    } else if (value !== undefined) {
      result.set(key, value);
    }
  }
  return result;
}

export function signalHref(
  pathname: string,
  input: SearchParamsInput,
  overrides: Readonly<Record<string, string | null | undefined>> = {},
): string {
  const params = toSearchParams(input);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
