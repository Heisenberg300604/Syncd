package com.syncd.android.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncd.android.core.socket.ConnectionState
import kotlin.math.absoluteValue

@Composable
fun SyncDCard(
    modifier: Modifier = Modifier,
    padding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .clip(MaterialTheme.shapes.large)
            .background(SyncDColors.Raised)
            .border(1.dp, SyncDColors.Line, MaterialTheme.shapes.large)
            .padding(padding),
        content = content,
    )
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: ImageVector? = null,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.heightIn(min = 52.dp),
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = SyncDColors.Accent,
            contentColor = SyncDColors.AccentInk,
            disabledContainerColor = SyncDColors.AccentLo,
            disabledContentColor = SyncDColors.InkMuted,
        ),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(18.dp), color = SyncDColors.AccentInk, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    contentColor: Color = SyncDColors.Ink,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 48.dp),
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(1.dp, SyncDColors.LineStrong),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = contentColor),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

/** Small status chip. Always pairs color with text so status never relies on color alone. */
@Composable
fun StatusPill(text: String, color: Color, modifier: Modifier = Modifier, showDot: Boolean = true) {
    Row(
        modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .border(1.dp, color.copy(alpha = 0.3f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showDot) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

/** CSS-only-style initials avatar (matches the web's generated avatars rather than fetching images). */
@Composable
fun Avatar(name: String, modifier: Modifier = Modifier, size: Dp = 36.dp, online: Boolean? = null) {
    val palette = listOf(
        Color(0xFFF7A23B), Color(0xFFF97316), Color(0xFF7DD3FC), Color(0xFF34D399),
        Color(0xFFFBBF24), Color(0xFFF472B6), Color(0xFFA78BFA),
    )
    val tint = palette[name.hashCode().absoluteValue % palette.size]
    Box(modifier.size(size).clearAndSetSemantics { }) {
        Box(
            Modifier.fillMaxSize().clip(CircleShape).background(tint.copy(alpha = 0.18f))
                .border(1.dp, tint.copy(alpha = 0.45f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                name.take(1).uppercase(),
                color = tint,
                fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.42f).sp,
            )
        }
        if (online != null) {
            Box(
                Modifier.align(Alignment.BottomEnd).size(size * 0.3f).clip(CircleShape)
                    .background(SyncDColors.Raised).padding(2.dp).clip(CircleShape)
                    .background(if (online) SyncDColors.Online else SyncDColors.InkFaint),
            )
        }
    }
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier, trailing: @Composable (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = SyncDColors.InkMuted,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        trailing?.invoke()
    }
}

// ---- Full-screen states ------------------------------------------------------------

@Composable
fun LoadingState(message: String? = null, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxSize().padding(24.dp).semantics { contentDescription = message ?: "Loading" },
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = SyncDColors.Accent, strokeWidth = 3.dp)
        if (message != null) {
            Spacer(Modifier.size(16.dp))
            Text(message, style = MaterialTheme.typography.bodyMedium, color = SyncDColors.InkMuted)
        }
    }
}

@Composable
fun MessageState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.ErrorOutline,
    iconTint: Color = SyncDColors.Danger,
    primaryAction: Pair<String, () -> Unit>? = null,
    secondaryAction: Pair<String, () -> Unit>? = null,
) {
    Column(
        modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(64.dp).clip(RoundedCornerShape(20.dp)).background(iconTint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(30.dp)) }
        Spacer(Modifier.size(20.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.size(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = SyncDColors.InkMuted, textAlign = TextAlign.Center)
        if (primaryAction != null) {
            Spacer(Modifier.size(24.dp))
            PrimaryButton(primaryAction.first, primaryAction.second, Modifier.fillMaxWidth())
        }
        if (secondaryAction != null) {
            Spacer(Modifier.size(10.dp))
            SecondaryButton(secondaryAction.first, secondaryAction.second, Modifier.fillMaxWidth())
        }
    }
}

/** Connection state as a labelled pill — for the room header and settings. */
@Composable
fun ConnectionPill(state: ConnectionState, modifier: Modifier = Modifier) {
    val (label, color) = connectionLabel(state)
    StatusPill(label, color, modifier.semantics { contentDescription = "Connection: $label" })
}

fun connectionLabel(state: ConnectionState): Pair<String, Color> = when (state) {
    ConnectionState.Connected -> "Live" to SyncDColors.Online
    ConnectionState.Connecting -> "Connecting" to SyncDColors.Warning
    is ConnectionState.Reconnecting -> "Reconnecting" to SyncDColors.Warning
    ConnectionState.Offline -> "Offline" to SyncDColors.Danger
    ConnectionState.Idle -> "Not connected" to SyncDColors.InkFaint
}
