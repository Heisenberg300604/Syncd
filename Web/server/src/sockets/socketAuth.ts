/**
 * Decides whether a verified session token's `azp` (authorized party) claim
 * is acceptable for a socket handshake.
 *
 * Clerk sets `azp` from the browser's Origin when a web page mints a token.
 * Pinning it to the frontends this API serves stops a token minted for a
 * different origin on the same Clerk instance from being replayed here, so a
 * present-but-unknown `azp` is rejected.
 *
 * Native clients (the iOS and Android apps) mint tokens through Clerk's native
 * API, which sends no Origin, so their tokens carry no `azp` at all. Clerk's
 * built-in `authorizedParties` option rejects those too, which locked every
 * mobile client out of realtime rooms. A missing `azp` is accepted: such a
 * token is still signature-verified for this Clerk instance, and the REST API
 * (`clerkMiddleware()` without `authorizedParties`) already accepts it.
 */
export function isAuthorizedParty(
  azp: unknown,
  authorizedParties: readonly string[],
): boolean {
  if (azp === undefined || azp === null) return true;
  if (typeof azp !== "string") return false;
  return authorizedParties.includes(azp);
}
