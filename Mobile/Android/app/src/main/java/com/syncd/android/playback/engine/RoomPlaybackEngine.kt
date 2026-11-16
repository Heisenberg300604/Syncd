package com.syncd.android.playback.engine

import kotlinx.coroutines.flow.StateFlow

enum class EngineStatus { Idle, Loading, Buffering, Playing, Paused, Ended, Error }

data class EngineState(
    val status: EngineStatus = EngineStatus.Idle,
    val videoId: String? = null,
    val durationSec: Double? = null,
    val error: String? = null,
)

/**
 * A player that renders the room's shared track locally. The sync coordinator
 * drives it; it never talks to the server and never decides what plays.
 */
interface RoomPlaybackEngine {
    val state: StateFlow<EngineState>

    /** Fine-grained speed control (enables gradual drift correction). */
    val supportsRateCorrection: Boolean

    /** Current local playhead, interpolated between engine reports. */
    fun positionSec(): Double

    fun load(videoId: String, startSec: Double, autoplay: Boolean)
    fun play()
    fun pause()
    fun seekTo(sec: Double)
    fun setRate(rate: Float)
    fun stop()
}
