export const MESSAGE_MAX_LENGTH = 500;

export type MessageContentValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateMessageContent(raw: unknown): MessageContentValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Message is required" };
  }

  const value = raw.trim();

  if (value.length === 0) {
    return { ok: false, message: "Message cannot be empty" };
  }

  if (value.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Message must be at most ${MESSAGE_MAX_LENGTH} characters`,
    };
  }

  return { ok: true, value };
}
