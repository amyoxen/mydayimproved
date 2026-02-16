package com.magicmac.myday.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Purple = Color(0xFFE8D4F8)
private val DarkPurple = Color(0xFF8B5A5A)
private val TextDark = Color(0xFF2D2D2D)
private val TextMuted = Color(0xFF6B6B6B)

private val LightColors = lightColorScheme(
    primary = DarkPurple,
    onPrimary = Color.White,
    background = Purple,
    onBackground = TextDark,
    surface = Color.White.copy(alpha = 0.3f),
    onSurface = TextDark,
    surfaceVariant = Color.White.copy(alpha = 0.5f),
    onSurfaceVariant = TextMuted,
)

private val DarkColors = darkColorScheme(
    primary = DarkPurple,
    onPrimary = Color.White,
    background = Color(0xFF1A1A1A),
    onBackground = Color.White,
    surface = Color(0xFF2D2D2D),
    onSurface = Color.White,
)

@Composable
fun MyDayTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (androidx.compose.foundation.isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
