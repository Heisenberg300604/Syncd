package com.syncd.android.core.auth

import kotlinx.coroutines.flow.StateFlow

/** Supplies the Clerk session JWT the backend verifies. Never log the value. */
fun interface TokenProvider {
    /**
     * @param forceRefresh bypass the SDK cache — used after a 401 and before every
     *   socket handshake attempt, since the socket verifies the token only once.
     * @return null when there is no signed-in session.
     */
    suspend fun token(forceRefresh: Boolean): String?
}

sealed interface AuthState {
    data object Initializing : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val sessionId: String) : AuthState
    /** The auth SDK could not start (bad key, no network on first launch, …). */
    data class Unavailable(val message: String) : AuthState
}

/** Identity boundary. The app never decides identity itself — the backend derives it from the token. */
interface AuthSession : TokenProvider {
    val state: StateFlow<AuthState>
    suspend fun signOut(): Result<Unit>
    /** Re-attempts SDK initialisation after [AuthState.Unavailable]. */
    fun retryInitialization()
}
