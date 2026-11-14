package com.syncd.android.data.repository

import com.syncd.android.core.model.CreateProfileRequest
import com.syncd.android.core.model.PublicUser
import com.syncd.android.core.network.ApiError
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.network.SyncDApi
import com.syncd.android.core.network.apiCall
import com.syncd.android.core.network.map
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface ProfileState {
    data object Idle : ProfileState
    data object Loading : ProfileState
    data object NeedsOnboarding : ProfileState
    data class Ready(val user: PublicUser) : ProfileState
    data class Error(val error: ApiError) : ProfileState
}

/**
 * The SyncD application user (`GET /api/me`), fetched once per signed-in session
 * and shared — same policy as the web CurrentUserProvider. Only a successful
 * response with `onboardingComplete: false` routes to onboarding; a failed or
 * slow `/me` shows a retryable error instead.
 */
class UserRepository(private val api: SyncDApi) {
    private val _state = MutableStateFlow<ProfileState>(ProfileState.Idle)
    val state: StateFlow<ProfileState> = _state.asStateFlow()

    val currentUser: PublicUser? get() = (_state.value as? ProfileState.Ready)?.user

    suspend fun refresh() {
        _state.value = ProfileState.Loading
        _state.value = when (val r = apiCall { api.me() }) {
            is ApiResult.Success -> {
                val user = r.value.user
                if (r.value.onboardingComplete && user != null) ProfileState.Ready(user) else ProfileState.NeedsOnboarding
            }
            is ApiResult.Failure -> ProfileState.Error(r.error)
        }
    }

    /** Seeds the shared state from the creation response — no second `/me` round trip to race. */
    suspend fun createProfile(username: String): ApiResult<PublicUser> =
        apiCall { api.createProfile(CreateProfileRequest(username.trim())) }
            .map { it.user }
            .also { if (it is ApiResult.Success) _state.value = ProfileState.Ready(it.value) }

    fun clear() {
        _state.value = ProfileState.Idle
    }
}
