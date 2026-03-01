package com.otppoc.android.views

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing
import com.otppoc.android.viewmodels.AuthViewModel
import kotlinx.coroutines.delay

@Composable
fun LoadingView(viewModel: AuthViewModel) {
    val statusMessage by viewModel.statusMessage.collectAsState()
    var dotIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(400)
            dotIndex = (dotIndex + 1) % 3
        }
    }

    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(AppSpacing.cardRadius),
                ambientColor = Color.Black.copy(alpha = 0.06f)
            )
            .background(AppColors.surface, RoundedCornerShape(AppSpacing.cardRadius))
            .padding(AppSpacing.cardPadding)
            .fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until 3) {
                val scale by animateFloatAsState(
                    targetValue = if (dotIndex == i) 1.3f else 0.7f,
                    animationSpec = tween(400, easing = EaseInOut),
                    label = "dot_scale_$i"
                )
                val alpha by animateFloatAsState(
                    targetValue = if (dotIndex == i) 1f else 0.4f,
                    animationSpec = tween(400, easing = EaseInOut),
                    label = "dot_alpha_$i"
                )
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .scale(scale)
                        .background(
                            AppColors.brand500.copy(alpha = alpha),
                            CircleShape
                        )
                )
            }
        }

        if (statusMessage.isNotEmpty()) {
            Text(
                text = statusMessage,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.textSecondary,
                textAlign = TextAlign.Center
            )
        }
    }
}
