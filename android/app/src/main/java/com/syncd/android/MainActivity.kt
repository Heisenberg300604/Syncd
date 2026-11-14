package com.syncd.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.design.SyncDTheme
import com.syncd.android.navigation.AppRoot
import androidx.compose.ui.graphics.toArgb

/**
 * Single activity. It does not own any player: room (YouTube) playback lives in
 * the room screen's visible player view, and native playback lives in
 * PlaybackService. The activity only binds/unbinds the MediaController with its
 * own start/stop so no binding outlives the visible UI.
 *
 * No deep links / intent extras are consumed, so there is no external input to validate.
 */
class MainActivity : ComponentActivity() {

    private val container get() = (application as SyncDApplication).container

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(SyncDColors.Canvas.toArgb()),
            navigationBarStyle = SystemBarStyle.dark(SyncDColors.Surface.toArgb()),
        )
        super.onCreate(savedInstanceState)
        setContent {
            SyncDTheme { AppRoot() }
        }
    }

    override fun onStart() {
        super.onStart()
        container.playback.connect()
    }

    override fun onStop() {
        container.playback.release()
        super.onStop()
    }
}
