package com.syncd.android.core.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape

/**
 * SyncD tokens — values copied from client/src/index.css `@theme` so Android and
 * web read as one warm, dark-first system. Change them together.
 */
object SyncDColors {
    val Canvas = Color(0xFF0A0908)
    val Surface = Color(0xFF12100E)
    val Raised = Color(0xFF181512)
    val Overlay = Color(0xFF201B16)
    val Line = Color(0x14FFFFFF)
    val LineStrong = Color(0x29FFFFFF)
    val Ink = Color(0xFFF5F3F0)
    val InkMuted = Color(0xFFB0A79C)
    /** Decorative / tertiary text only — below 4.5:1 on Canvas for small text. */
    val InkFaint = Color(0xFF7C7167)
    val Accent = Color(0xFFF7A23B)
    val AccentHi = Color(0xFFF97316)
    val AccentLo = Color(0x1FF7A23B)
    val AccentInk = Color(0xFF1A1206)
    val Cool = Color(0xFF7DD3FC)
    val Online = Color(0xFF34D399)
    val Warning = Color(0xFFFBBF24)
    val Danger = Color(0xFFF87171)
}

private val colorScheme = darkColorScheme(
    primary = SyncDColors.Accent,
    onPrimary = SyncDColors.AccentInk,
    primaryContainer = SyncDColors.AccentLo,
    onPrimaryContainer = SyncDColors.Accent,
    secondary = SyncDColors.Cool,
    onSecondary = SyncDColors.Canvas,
    tertiary = SyncDColors.AccentHi,
    background = SyncDColors.Canvas,
    onBackground = SyncDColors.Ink,
    surface = SyncDColors.Surface,
    onSurface = SyncDColors.Ink,
    surfaceVariant = SyncDColors.Raised,
    onSurfaceVariant = SyncDColors.InkMuted,
    surfaceContainerLowest = SyncDColors.Canvas,
    surfaceContainerLow = SyncDColors.Surface,
    surfaceContainer = SyncDColors.Raised,
    surfaceContainerHigh = SyncDColors.Overlay,
    surfaceContainerHighest = SyncDColors.Overlay,
    outline = SyncDColors.LineStrong,
    outlineVariant = SyncDColors.Line,
    error = SyncDColors.Danger,
    onError = SyncDColors.Canvas,
)

// Web uses Manrope; the platform sans is used here until the font is bundled.
private val base = TextStyle(fontFamily = FontFamily.SansSerif, color = SyncDColors.Ink)

private val typography = Typography(
    displaySmall = base.copy(fontSize = 34.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
    headlineMedium = base.copy(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
    headlineSmall = base.copy(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
    titleLarge = base.copy(fontSize = 19.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = base.copy(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = base.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = base.copy(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = base.copy(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = base.copy(fontSize = 12.sp, lineHeight = 16.sp, color = SyncDColors.InkMuted),
    labelLarge = base.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = base.copy(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
    labelSmall = base.copy(fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp),
)

private val shapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(26.dp),
)

@Composable
fun SyncDTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colorScheme, typography = typography, shapes = shapes, content = content)
}
