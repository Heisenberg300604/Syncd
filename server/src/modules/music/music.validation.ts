export const SEARCH_QUERY_MIN_LENGTH = 1;
export const SEARCH_QUERY_MAX_LENGTH = 200;
export const SEARCH_MAX_RESULTS = 20;

export type SearchQueryValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateSearchQuery(raw: unknown): SearchQueryValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Search query is required" };
  }

  const value = raw.trim();

  if (value.length < SEARCH_QUERY_MIN_LENGTH) {
    return { ok: false, message: "Search query is required" };
  }

  if (value.length > SEARCH_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      message: `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters`,
    };
  }

  return { ok: true, value };
}