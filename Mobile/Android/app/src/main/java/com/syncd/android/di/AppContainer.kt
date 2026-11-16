package com.syncd.android.di

import android.app.Application
import android.os.SystemClock
import com.syncd.android.core.auth.AuthSession
import com.syncd.android.core.auth.AuthState
import com.syncd.android.core.auth.ClerkAuthSession
import com.syncd.android.core.config.AppConfig
import com.syncd.android.core.network.NetworkFactory
import com.syncd.android.core.network.SyncDApi
import com.syncd.android.core.socket.NetworkMonitor
import com.syncd.android.core.socket.RealtimeClient
import com.syncd.android.core.socket.SocketIoRealtimeClient
import com.syncd.android.data.local.RecentRoomsStore
import com.syncd.android.data.repository.MusicRepository
import com.syncd.android.data.repository.RoomSessionRepository
import com.syncd.android.data.repository.UserRepository
import com.syncd.android.feature.room.RoomPlayerSlot
import com.syncd.android.playback.coordinator.RoomSyncCoordinator
import com.syncd.android.playback.engine.YouTubeRoomEngine
import com.syncd.android.playback.session.PlaybackConnection
import com.syncd.android.playback.synchronization.DriftPolicy
import com.syncd.android.playback.synchronization.ServerClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient

/**
 * Manual dependency container — one instance per process, created by
 * [com.syncd.android.SyncDApplication]. Everything here is app-scoped, which is
 * what guarantees a single socket connection, a single active room and a single
 * playback session.
 */
class AppContainer(application: Application) {
    val config: AppConfig = AppConfig.fromBuildConfig()

    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val monotonicNowMs: () -> Long = SystemClock::elapsedRealtime

    val auth: AuthSession =
        if (config.problems().isEmpty()) {
            ClerkAuthSession(application, config.clerkPublishableKey, appScope)
        } else {
            MisconfiguredAuthSession(config.problems().joinToString("\n"))
        }

    val okHttp: OkHttpClient = NetworkFactory.baseClient()
    val api: SyncDApi = NetworkFactory.api(okHttp, config.retrofitBaseUrl, auth)

    val network = NetworkMonitor(application)
    val serverClock = ServerClock(monotonicNowMs)
    val driftPolicy = DriftPolicy()

    val realtime: RealtimeClient = SocketIoRealtimeClient(
        scope = appScope,
        socketUrl = config.socketUrl,
        okHttp = okHttp,
        tokens = auth,
        networkAvailable = network.online,
        monotonicNowMs = monotonicNowMs,
    )

    val users = UserRepository(api)
    val music = MusicRepository(api)
    val recentRooms = RecentRoomsStore(application)
    val rooms = RoomSessionRepository(
        scope = appScope,
        stateDispatcher = Dispatchers.Main.immediate,
        api = api,
        realtime = realtime,
        clock = serverClock,
        recents = recentRooms,
        selfUser = { users.currentUser },
    )

    val playback = PlaybackConnection(application)

    /**
     * The active room's YouTube player and its sync, app-scoped so music keeps
     * playing while the user moves around the app (not only on the room screen).
     * Rendered by [com.syncd.android.feature.room.PersistentRoomPlayer].
     */
    val roomEngine = YouTubeRoomEngine(monotonicNowMs)
    val roomSync = RoomSyncCoordinator(
        scope = appScope,
        clock = serverClock,
        policy = driftPolicy,
        monotonicNowMs = monotonicNowMs,
        onTrackEnded = {
            // Only the host advances the shared queue (the server enforces this too).
            if (rooms.state.value?.isHost(users.currentUser?.id) == true) appScope.launch { rooms.queueAdvance() }
        },
    )
    val roomPlayerSlot = RoomPlayerSlot()

    /** Clears every piece of signed-in state, then ends the Clerk session. */
    suspend fun signOut(): Result<Unit> {
        playback.stop()
        rooms.reset()
        recentRooms.clear()
        users.clear()
        return auth.signOut()
    }
}

/** Keeps the app launchable (with a setup screen) when public config is missing. */
private class MisconfiguredAuthSession(message: String) : AuthSession {
    override val state: StateFlow<AuthState> = MutableStateFlow(AuthState.Unavailable(message))
    override suspend fun token(forceRefresh: Boolean): String? = null
    override suspend fun signOut() = Result.success(Unit)
    override fun retryInitialization() = Unit
}
