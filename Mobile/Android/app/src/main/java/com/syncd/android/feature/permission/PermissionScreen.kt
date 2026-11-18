package com.syncd.android.feature.permission

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncd.android.core.design.PrimaryButton
import com.syncd.android.core.design.SecondaryButton
import com.syncd.android.core.design.SyncDCard
import com.syncd.android.core.design.SyncDColors

@Composable
fun PermissionScreen(
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Manifest.permission.READ_MEDIA_AUDIO
    } else {
        Manifest.permission.READ_EXTERNAL_STORAGE
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
        onContinue()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(SyncDColors.Canvas)
            .statusBarsPadding()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 380.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(26.dp))
                    .background(SyncDColors.AccentLo)
                    .border(1.dp, SyncDColors.Accent.copy(alpha = 0.35f), RoundedCornerShape(26.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.MusicNote,
                    contentDescription = null,
                    tint = SyncDColors.Accent,
                    modifier = Modifier.size(42.dp),
                )
            }

            Spacer(Modifier.height(24.dp))

            Text(
                text = "Audio on this device",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = SyncDColors.Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "SyncD can automatically find and list your device's audio tracks so you can play them with background audio and lock-screen controls.",
                style = MaterialTheme.typography.bodyMedium,
                color = SyncDColors.InkMuted,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )

            Spacer(Modifier.height(28.dp))

            SyncDCard(
                modifier = Modifier.fillMaxWidth(),
                padding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            ) {
                FeatureRow(
                    icon = Icons.Outlined.GraphicEq,
                    title = "Auto-scan library",
                    subtitle = "Instantly browse and play your songs",
                )
                Spacer(Modifier.height(14.dp))
                FeatureRow(
                    icon = Icons.Outlined.Lock,
                    title = "Completely private",
                    subtitle = "Device files are never shared with rooms",
                )
            }

            Spacer(Modifier.height(32.dp))

            PrimaryButton(
                text = "Allow Audio Access",
                onClick = { launcher.launch(permission) },
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(12.dp))

            SecondaryButton(
                text = "Not now",
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun FeatureRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(SyncDColors.Overlay),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(title, style = MaterialTheme.typography.titleSmall, color = SyncDColors.Ink)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = SyncDColors.InkMuted)
        }
    }
}
