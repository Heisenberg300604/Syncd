package com.syncd.android.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncd.android.SyncDApplication
import com.syncd.android.core.auth.AuthState
import com.syncd.android.core.design.LoadingState
import com.syncd.android.core.design.MessageState
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.network.ApiError
import com.syncd.android.data.repository.ProfileState
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.feature.auth.OnboardingScreen
import com.syncd.android.feature.auth.SignInScreen
import com.syncd.android.feature.home.HomeScreen
import com.syncd.android.feature.permission.PermissionScreen
import com.syncd.android.feature.player.FullPlayerScreen
import com.syncd.android.feature.player.MiniPlayer
import com.syncd.android.feature.profile.ProfileScreen
import com.syncd.android.feature.room.ActiveRoomTabScreen
import com.syncd.android.feature.room.PersistentRoomPlayer
import com.syncd.android.feature.search.SearchSheet
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable data object HomeRoute
@Serializable data object RoomTabRoute
@Serializable data object PlayerRoute
@Serializable data object ProfileRoute
@Serializable data class RoomRoute(val code: String)

/** Session gate: auth → `/me` → onboarding → app. Mirrors the web route guards. */
class AppRootViewModel(private val c: AppContainer) : ViewModel() {
    val auth = c.auth.state
    val profile = c.users.state
    val hasSeenPermissions = c.userPrefs.hasSeenPermissionScreen
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

    fun markPermissionOnboarded() {
        viewModelScope.launch { c.userPrefs.setPermissionOnboarded(true) }
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
    val hasSeenPermissions by vm.hasSeenPermissions.collectAsState(initial = true)

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
                is ProfileState.Ready -> {
                    if (!hasSeenPermissions) {
                        PermissionScreen(onContinue = vm::markPermissionOnboarded)
                    } else {
                        MainScaffold(onSignOut = vm::signOut)
                    }
                }
            }
        }
    }
}

@Composable
private fun MainScaffold(onSignOut: () -> Unit) {
    val context = LocalContext.current
    val app = context.applicationContext as SyncDApplication
    val activeRoom by app.container.rooms.state.collectAsState()
    val inRoom = activeRoom?.takeIf { it.phase !is RoomPhase.Closed && it.phase !is RoomPhase.Removed } != null
    var searchSheetOpen by remember { mutableStateOf(false) }

    val pagerState = rememberPagerState(initialPage = 0, pageCount = { AppTab.entries.size })
    val coroutineScope = rememberCoroutineScope()
    val currentTab = AppTab.entries[pagerState.currentPage]

    BackHandler(enabled = pagerState.currentPage != 0) {
        coroutineScope.launch { pagerState.animateScrollToPage(0) }
    }

    Scaffold(
        containerColor = SyncDColors.Canvas,
        bottomBar = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // MiniPlayer: show when local device media is playing
                if (currentTab != AppTab.PLAYER) {
                    MiniPlayer(
                        onOpenPlayer = { coroutineScope.launch { pagerState.animateScrollToPage(AppTab.PLAYER.ordinal) } },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                // FloatingNavBar is kept active across ALL screens, including Player!
                FloatingNavBar(
                    currentTab = currentTab,
                    onTabSelected = { tab ->
                        coroutineScope.launch { pagerState.animateScrollToPage(tab.ordinal) }
                    },
                    inRoom = inRoom,
                    onAddMusic = { searchSheetOpen = true },
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize()) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) { page ->
                when (AppTab.entries[page]) {
                    AppTab.HOME -> HomeScreen(
                        onOpenRoom = { _ -> coroutineScope.launch { pagerState.animateScrollToPage(AppTab.ROOM.ordinal) } },
                    )
                    AppTab.ROOM -> ActiveRoomTabScreen(
                        onGoHome = { coroutineScope.launch { pagerState.animateScrollToPage(AppTab.HOME.ordinal) } },
                    )
                    AppTab.PLAYER -> FullPlayerScreen(
                        onBack = null,
                    )
                    AppTab.PROFILE -> ProfileScreen(
                        onSignOut = onSignOut,
                    )
                }
            }

            // Above every screen: the room's video (in slot on room screen, or draggable floating mini player)
            PersistentRoomPlayer(
                c = app.container,
                bottomInset = padding.calculateBottomPadding(),
                onOpenRoom = { _ -> coroutineScope.launch { pagerState.animateScrollToPage(AppTab.ROOM.ordinal) } },
            )

            // Room search sheet opened from the floating navbar
            if (searchSheetOpen && inRoom) {
                SearchSheet(
                    somethingPlaying = activeRoom?.playback?.videoId != null,
                    onDismiss = { searchSheetOpen = false },
                )
            }
        }
    }
}
