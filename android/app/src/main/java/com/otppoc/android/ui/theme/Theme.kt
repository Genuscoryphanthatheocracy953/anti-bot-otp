package com.otppoc.android.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object AppColors {
    val brand900 = Color(0xFF0F172A)
    val brand800 = Color(0xFF1E293B)
    val brand500 = Color(0xFF3B82F6)
    val brand400 = Color(0xFF60A5FA)
    val brand100 = Color(0xFFDBE7FE)
    val surface = Color.White
    val bg = Color(0xFFF8FAFB)
    val textPrimary = Color(0xFF0F172A)
    val textSecondary = Color(0xFF64748B)
    val textMuted = Color(0xFF94A3B8)
    val border = Color(0xFFE2E8F0)
    val success = Color(0xFF10B981)
    val successBg = Color(0xFFECFDF5)
    val error = Color(0xFFEF4444)
    val errorBg = Color(0xFFFEF2F2)
    val defenseBg = Color(0xFFF0F9FF)
    val defenseBorder = Color(0xFFBAE6FD)
    val defenseIcon = Color(0xFF0EA5E9)

    val heroGradient = Brush.linearGradient(
        colors = listOf(brand900, brand800)
    )
}

object AppSpacing {
    val cardRadius = 16.dp
    val cardPadding = 24.dp
    val inputRadius = 12.dp
    val buttonRadius = 12.dp
    val buttonHeight = 50.dp
    val sectionGap = 24.dp
    val innerGap = 16.dp
}
