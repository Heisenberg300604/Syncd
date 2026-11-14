package com.syncd.android.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.syncd.android.core.auth.AuthState
import com.syncd.android.core.design.LoadingState
import com.syncd.android.core.design.MessageState
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.network.ApiError
import com.syncd.android.data.repository.ProfileState
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel
import com.syncd.android.feature.auth.OnboardingScreen
import com.syncd.android.feature.auth.SignInScreen
import com.syncd.android.feature.home.HomeScreen
import com.syncd.android.feature.player.FullPlayerScreen
import com.syncd.android.feature.player.MiniPlayer
import com.syncd.android.feature.profile.ProfileScreen
import com.syncd.android.feature.room.RoomScreen
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable data object HomeRoute
@Serializable data object ProfileRoute
@Serializable data class RoomRoute(val code: String)
@Serializable data object PlayerRoute

/** Session gate: auth → `/me` → onboarding → app. Mirrors the web route guards. */
class AppRootViewModel(private val c: AppContainer) : ViewModel() {
    val auth = c.auth.state
    val profile = c.users.state
    private var lastSessionId: String? = null

    init {
        viewModelScope.launch {
            c.auth.state.collect { s ->
                when (s) {
                    is AuthState.SignedIn -> if (s.sessionId != lastSessionId) {
                        lastSessionId = s.sessionId
                        c.users.refresh()
                    }
                    AuthState.SignedOut -> if (lastSessionId != null) {
                        // Ended elsewhere (revoked, expired): drop all signed-in state.
                        lastSessionId = null
                        c.rooms.reset()
                        c.users.clear()
                        c.recentRooms.clear()
                        c.playback.stop()
                    }
                    else -> Unit
                }
            }
        }
    }

    fun retryAuth() = c.auth.retryInitialization()

    fun retryProfile() {
        viewModelScope.launch { c.users.refresh() }
    }

    fun signOut() {
        viewModelScope.launch { c.signOut() }
    }
}

@Composable
fun AppRoot() {
    val vm = appViewModel { AppRootViewModel(it) }
    val auth by vm.auth.collectAsState()
    val profile by vm.profile.collectAsState()

    Box(Modifier.fillMaxSize().background(SyncDColors.Canvas)) {
        when (val a = auth) {
            AuthState.Initializing -> LoadingState("Starting SyncD…")
            is AuthState.Unavailable -> MessageState(
                title = "Can't start sign-in",
                message = a.message,
                icon = Icons.Outlined.CloudOff,
                primaryAction = "Try again" to vm::retryAuth,
            )
            AuthState.SignedOut -> SignInScreen()
            is AuthState.SignedIn -> when (val p = profile) {
                ProfileState.Idle, ProfileState.Loading -> LoadingState("Loading your profile…")
                ProfileState.NeedsOnboarding -> OnboardingScreen(onSignOut = vm::signOut)
                is ProfileState.Error -> MessageState(
                    title = if (p.error is ApiError.Unauthorized) "Session expired" else "Couldn't load your profile",
                    message = p.error.message,
                    primaryAction = if (p.error is ApiError.Unauthorized) "Sign in again" to vm::signOut else "Try again" to vm::retryProfile,
                    secondaryAction = if (p.error is ApiError.Unauthorized) null else "Sign out" to vm::signOut,
                )
                is ProfileState.Ready -> MainScaffold(onSignOut = vm::signOut)
            }
        }
    }
}

@Composable
private fun MainScaffold(onSignOut: () -> Unit) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val destination = entry?.destination
    val topLevel = destination?.hasRoute<HomeRoute>() == true || destination?.hasRoute<ProfileRoute>() == true

    fun goTopLevel(route: Any) = nav.navigate(route) {
        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

    Scaffold(
        containerColor = SyncDColors.Canvas,
        bottomBar = {
            if (topLevel) {
                Column {
                    MiniPlayer(
                        onOpenPlayer = { nav.navigate(PlayerRoute) },
                        onOpenRoom = { code -> nav.navigate(RoomRoute(code)) },
                    )
                    NavigationBar(containerColor = SyncDColors.Surface) {
                        val colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SyncDColors.AccentInk,
                            indicatorColor = SyncDColors.Accent,
                            selectedTextColor = SyncDColors.Ink,
                            unselectedIconColor = SyncDColors.InkMuted,
                            unselectedTextColor = SyncDColors.InkMuted,
                        )
                        NavigationBarItem(
                            selected = destination.hasRoute<HomeRoute>(),
                            onClick = { goTopLevel(HomeRoute) },
                            icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                            label = { Text("Home") },
                            colors = colors,
                        )
                        NavigationBarItem(
                            selected = destination.hasRoute<ProfileRoute>(),
                            onClick = { goTopLevel(ProfileRoute) },
                            icon = { Icon(Icons.Filled.Person, contentDescription = null) },
                            label = { Text("Profile") },
                            colors = colors,
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = HomeRoute, modifier = Modifier.padding(padding)) {
            composable<HomeRoute> {
                HomeScreen(
                    onOpenRoom = { code -> nav.navigate(RoomRoute(code)) { launchSingleTop = true } },
                    onOpenPlayer = { nav.navigate(PlayerRoute) },
                )
            }
            composable<ProfileRoute> { ProfileScreen(onSignOut = onSignOut) }
            composable<RoomRoute> { backStack ->
                val route = backStack.toRoute<RoomRoute>()
                RoomScreen(code = route.code, onBack = { nav.popBackStack() })
            }
            composable<PlayerRoute> { FullPlayerScreen(onBack = { nav.popBackStack() }) }
        }
    }
}
