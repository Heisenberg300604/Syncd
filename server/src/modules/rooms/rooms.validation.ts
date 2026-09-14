import { randomInt } from "node:crypto";

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

/**
 * The room code is the only thing guarding a room — anyone holding it can join.
 * That makes it a capability, so it comes from the CSPRNG: `Math.random()` is a
 * seeded PRNG whose internal state can be recovered from a handful of observed
 * outputs, which would let an attacker who creates a few rooms predict the
 * codes handed to other users. `randomInt` is also rejection-sampled, so the
 * 31-character alphabet stays uniform.
 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

export const ROOM_CODE_MAX_RETRIES_OUT = ROOM_CODE_MAX_RETRIES;