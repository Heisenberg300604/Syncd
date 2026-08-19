export const ROOM_CODE_LENGTH = 6;
// Unambiguous uppercase alphabet: no O/0/I/1/L to avoid confusion
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_MAX_RETRIES = 10;

export type RoomCodeValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

function normalize(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateRoomCode(raw: unknown): RoomCodeValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Room code is required" };
  }

  const value = normalize(raw);

  if (value.length === 0) {
    return { ok: false, message: "Room code is required" };
  }

  if (value.length !== ROOM_CODE_LENGTH) {
    return {
      ok: false,
      message: `Room code must be ${ROOM_CODE_LENGTH} characters`,
    };
  }

  if (!/^[A-Z0-9]+$/.test(value)) {
    return {
      ok: false,
      message: "Room code can only contain letters and numbers",
    };
  }

  return { ok: true, value };
}

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    if (idx >= 0 && idx < ROOM_CODE_ALPHABET.length) {
      code += ROOM_CODE_ALPHABET[idx];
    }
  }
  return code;
}

export const ROOM_CODE_MAX_RETRIES_OUT = ROOM_CODE_MAX_RETRIES;