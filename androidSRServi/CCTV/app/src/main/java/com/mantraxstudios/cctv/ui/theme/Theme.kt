package com.mantraxstudios.cctv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AppColorScheme = darkColorScheme(
    primary = Color(0xFFD4AF37),
    onPrimary = Color(0xFF0A0A0A),
    background = Color(0xFF0A0A0A),
    surface = Color(0xFF141414),
    onBackground = Color.White,
    onSurface = Color.White,
)

@Composable
fun CCTVTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        typography = Typography,
        content = content
    )
}
