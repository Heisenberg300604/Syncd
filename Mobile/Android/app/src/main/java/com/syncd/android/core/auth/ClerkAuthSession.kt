package com.syncd.android.core.auth

import android.app.Application
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

/**
 * [AuthSession] backed by the official Clerk Android SDK — the same Clerk
 * instance the web client uses, so accounts and sessions are shared.
 *
 * Session persistence and token refresh are owned by the SDK (it stores its
 * client/device token itself); this app keeps no copy of any credential.
 */
class ClerkAuthSession(
    private val application: Application,
    private val publishableKey: String,
    scope: CoroutineScope,
) : AuthSession {

    init {
        Clerk.initialize(application, publishableKey)
    }

    override val state: StateFlow<AuthState> = combine(
        Clerk.isInitialized,
        Clerk.initializationError,
        Clerk.sessionFlow,
    ) { initialized, error, session ->
        when {
            session != null -> AuthState.SignedIn(session.id)
            error != null && !initialized -> AuthState.Unavailable(
                "Couldn't reach the sign-in service. Check your connection and try again.",
            )
            !initialized -> AuthState.Initializing
            else -> AuthState.SignedOut
        }
    }.stateIn(scope, SharingStarted.Eagerly, AuthState.Initializing)

    override suspend fun token(forceRefresh: Boolean): String? {
        if (Clerk.session == null) return null
        return when (val result = Clerk.auth.getToken(GetTokenOptions(skipCache = forceRefresh))) {
            is ClerkResult.Success -> result.value
            is ClerkResult.Failure -> null
        }
    }

    override suspend fun signOut(): Result<Unit> =
        when (val result = Clerk.auth.signOut()) {
            is ClerkResult.Success -> Result.success(Unit)
            is ClerkResult.Failure -> Result.failure(
                IllegalStateException("Sign-out failed. Check your connection and try again."),
            )
        }

    override fun retryInitialization() {
        if (!Clerk.reinitialize()) Clerk.initialize(application, publishableKey)
    }
}
