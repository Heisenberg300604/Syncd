package com.syncd.android.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clerk.api.ui.ClerkColors
import com.clerk.api.ui.ClerkTheme
import com.clerk.ui.auth.AuthView
import com.syncd.android.core.design.PrimaryButton
import com.syncd.android.core.design.SecondaryButton
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.network.ApiError
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.util.Usernames
import com.syncd.android.data.repository.UserRepository
import com.syncd.android.di.appViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private val clerkTheme = ClerkTheme(
    darkColors = ClerkColors(
        primary = SyncDColors.Accent,
        primaryForeground = SyncDColors.AccentInk,
        background = SyncDColors.Canvas,
        foreground = SyncDColors.Ink,
        mutedForeground = SyncDColors.InkMuted,
        input = SyncDColors.Raised,
        inputForeground = SyncDColors.Ink,
        border = SyncDColors.LineStrong,
        danger = SyncDColors.Danger,
        success = SyncDColors.Online,
        warning = SyncDColors.Warning,
        neutral = SyncDColors.InkMuted,
    ),
)

/**
 * Sign-in / sign-up via Clerk's prebuilt native flow — the same Clerk instance
 * (and so the same accounts, e.g. Google) as the web client. No custom auth.
 */
@Composable
fun SignInScreen() {
    Column(Modifier.fillMaxSize().systemBarsPadding()) {
        AuthView(
            modifier = Modifier.weight(1f),
            clerkTheme = clerkTheme,
            logo = { BrandMark() },
            isDismissible = false,
        )
    }
}

@Composable
fun BrandMark(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.GraphicEq, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(28.dp))
        Spacer(Modifier.size(8.dp))
        Text("SyncD", style = MaterialTheme.typography.headlineSmall)
    }
}

// ---- Onboarding --------------------------------------------------------------------

data class OnboardingUiState(
    val submitting: Boolean = false,
    val error: String? = null,
)

class OnboardingViewModel(private val users: UserRepository) : ViewModel() {
    private val _state = MutableStateFlow(OnboardingUiState())
    val state = _state.asStateFlow()

    fun submit(username: String) {
        Usernames.validate(username)?.let {
            _state.value = OnboardingUiState(error = it)
            return
        }
        _state.value = OnboardingUiState(submitting = true)
        viewModelScope.launch {
            when (val r = users.createProfile(username)) {
                is ApiResult.Success -> _state.value = OnboardingUiState() // repository state moves the app on
                is ApiResult.Failure -> _state.value = OnboardingUiState(
                    error = when (val e = r.error) {
                        is ApiError.Http -> if (e.status == 409) "That username is taken." else e.message
                        else -> e.message
                    },
                )
            }
        }
    }
}

@Composable
fun OnboardingScreen(onSignOut: () -> Unit) {
    val vm = appViewModel { OnboardingViewModel(it.users) }
    val state by vm.state.collectAsState()
    var username by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        BrandMark()
        Spacer(Modifier.height(32.dp))
        Text("Pick a username", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(8.dp))
        Text(
            "This is how you'll appear to people in your listening rooms.",
            style = MaterialTheme.typography.bodyMedium,
            color = SyncDColors.InkMuted,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it.take(20) },
            label = { Text("Username") },
            supportingText = { Text(state.error ?: "3–20 letters, numbers or underscores") },
            isError = state.error != null,
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { vm.submit(username) }),
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SyncDColors.Accent),
        )
        Spacer(Modifier.height(16.dp))
        PrimaryButton("Continue", { vm.submit(username) }, Modifier.fillMaxWidth(), loading = state.submitting)
        Spacer(Modifier.height(12.dp))
        SecondaryButton("Sign out", onSignOut, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Outlined.Logout)
    }
}
