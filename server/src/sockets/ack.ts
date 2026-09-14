/**
 * Sends a response on a client-supplied acknowledgement callback.
 *
 * Socket.IO hands a listener whatever the client put in the event's argument
 * list, so the "ack" parameter can be missing, or be a string, or be anything
 * else. Calling a non-function throws, and a throw inside a listener — or
 * inside the `.catch` that follows it — escapes into Socket.IO's
 * `process.nextTick` dispatch, where nothing catches it and the process exits.
 * Every reply goes through here so one malformed emit cannot take the server
 * down for every other room.
 */
export function reply<T>(ack: unknown, response: T): void {
  if (typeof ack === "function") {
    (ack as (res: T) => void)(response);
  }
}
