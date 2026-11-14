export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export type UsernameValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateUsername(raw: unknown): UsernameValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Username is required" };
  }

  const value = raw.trim();

  if (value.length === 0) {
    return { ok: false, message: "Username is required" };
  }

  if (value.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (value.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  if (!USERNAME_REGEX.test(value)) {
    return {
      ok: false,
      message: "Username can only contain letters, numbers, and underscores",
    };
  }

  return { ok: true, value };
}