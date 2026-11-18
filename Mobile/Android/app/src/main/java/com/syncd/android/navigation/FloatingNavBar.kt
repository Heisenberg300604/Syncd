package com.syncd.android.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.WifiTethering
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncd.android.core.design.SyncDColors

enum class AppTab(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Filled.Home),
    ROOM("Room", Icons.Filled.WifiTethering),
    PLAYER("Player", Icons.Filled.PlayCircle),
    PROFILE("Profile", Icons.Filled.AccountCircle),
}

/**
 * Floating glassmorphic capsule pill navigation bar.
 * Features translucent frosted glass background (11% white glass over dark canvas),
 * 30% border, top/left linear gradient reflection highlights, and glowing active tab pill.
 * Matches iOS 18 floating tab bar aesthetic.
 */
@Composable
fun FloatingNavBar(
    currentTab: AppTab,
    onTabSelected: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
    inRoom: Boolean = false,
    onAddMusic: (() -> Unit)? = null,
) {
    val tabWidth = if (inRoom) 58.dp else 68.dp
    val maxNavBarWidth = if (inRoom) 348.dp else 296.dp

    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier
                .widthIn(max = maxNavBarWidth)
                .fillMaxWidth()
                // Glass card shadow: 0 8px 32px rgba(0, 0, 0, 0.25)
                .shadow(
                    elevation = 20.dp,
                    shape = CircleShape,
                    spotColor = Color.Black.copy(alpha = 0.5f),
                    ambientColor = Color.Black.copy(alpha = 0.3f),
                )
                .clip(CircleShape)
                // Dark frosted backdrop + 11% white glass
                .background(Color(0xD9141210))
                .background(Color(0x1CFFFFFF)) // rgba(255, 255, 255, 0.11)
                // Border: 1px solid rgba(255, 255, 255, 0.3)
                .border(1.dp, Color(0x4DFFFFFF), CircleShape)
                // Top and left linear gradient reflection highlights (::before & ::after)
                .drawWithContent {
                    drawContent()
                    // ::before top reflection: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)
                    drawLine(
                        brush = Brush.horizontalGradient(
                            listOf(
                                Color.Transparent,
                                Color(0xCCFFFFFF),
                                Color.Transparent,
                            ),
                            startX = size.width * 0.10f,
                            endX = size.width * 0.90f,
                        ),
                        start = Offset(size.width * 0.10f, 1.2f),
                        end = Offset(size.width * 0.90f, 1.2f),
                        strokeWidth = 1.5.dp.toPx(),
                    )
                    // ::after left reflection: linear-gradient(180deg, rgba(255,255,255,0.8), transparent, rgba(255,255,255,0.3))
                    drawLine(
                        brush = Brush.verticalGradient(
                            listOf(
                                Color(0xCCFFFFFF),
                                Color.Transparent,
                                Color(0x4DFFFFFF),
                            ),
                            startY = size.height * 0.15f,
                            endY = size.height * 0.85f,
                        ),
                        start = Offset(1.5f, size.height * 0.15f),
                        end = Offset(1.5f, size.height * 0.85f),
                        strokeWidth = 1.2.dp.toPx(),
                    )
                    // Inset bottom subtle reflection: inset 0 -1px 0 rgba(255, 255, 255, 0.1)
                    drawLine(
                        brush = Brush.horizontalGradient(
                            listOf(
                                Color.Transparent,
                                Color(0x1AFFFFFF),
                                Color.Transparent,
                            ),
                            startX = size.width * 0.20f,
                            endX = size.width * 0.80f,
                        ),
                        start = Offset(size.width * 0.20f, size.height - 1f),
                        end = Offset(size.width * 0.80f, size.height - 1f),
                        strokeWidth = 1.dp.toPx(),
                    )
                }
                .padding(horizontal = 6.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            AppTab.entries.forEach { tab ->
                val selected = currentTab == tab
                // Active tab has a rich, warm dark surface capsule (matching iOS screenshot)
                val targetBg = if (selected) Color(0xFF282420) else Color.Transparent
                val targetBorder = if (selected) Color(0x38FFFFFF) else Color.Transparent
                val targetContent = if (selected) SyncDColors.Accent else Color(0xFFF5F3F0)

                val animatedBg by animateColorAsState(
                    targetValue = targetBg,
                    animationSpec = tween(durationMillis = 180),
                    label = "tab_bg",
                )
                val animatedBorder by animateColorAsState(
                    targetValue = targetBorder,
                    animationSpec = tween(durationMillis = 180),
                    label = "tab_border",
                )
                val animatedContent by animateColorAsState(
                    targetValue = targetContent,
                    animationSpec = tween(durationMillis = 180),
                    label = "tab_content",
                )

                Box(
                    modifier = Modifier
                        .width(tabWidth)
                        .height(48.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(animatedBg)
                        .border(1.dp, animatedBorder, RoundedCornerShape(18.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            role = Role.Tab,
                            onClick = { onTabSelected(tab) },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.label,
                            tint = animatedContent,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.height(1.dp))
                        Text(
                            text = tab.label,
                            fontSize = 10.5.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                            letterSpacing = (-0.1).sp,
                            color = animatedContent,
                            maxLines = 1,
                        )
                    }
                }

                // If in an active room, insert the "Add Music" search action right next to Room tab
                if (inRoom && tab == AppTab.ROOM) {
                    Box(
                        modifier = Modifier
                            .width(58.dp)
                            .height(48.dp)
                            .shadow(
                                elevation = 4.dp,
                                shape = RoundedCornerShape(18.dp),
                                spotColor = SyncDColors.Accent.copy(alpha = 0.4f),
                                ambientColor = Color.Black.copy(alpha = 0.2f),
                            )
                            .clip(RoundedCornerShape(18.dp))
                            // Solid amber background - NO glass, fully opaque
                            .background(SyncDColors.Accent)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                role = Role.Button,
                                onClick = { onAddMusic?.invoke() },
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = "Add music",
                                tint = SyncDColors.AccentInk,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.height(1.dp))
                            Text(
                                text = "Search",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = (-0.1).sp,
                                color = SyncDColors.AccentInk,
                                maxLines = 1,
                            )
                        }
                    }
                }
            }
        }
    }
}
