package com.otppoc.android.views.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors

private val steps = listOf("Phone", "Verify", "Done")

@Composable
fun StepIndicator(currentStep: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        steps.forEachIndexed { index, label ->
            if (index > 0) {
                val lineColor by animateColorAsState(
                    targetValue = if (index <= currentStep) AppColors.brand500 else AppColors.border,
                    animationSpec = spring(),
                    label = "line_color_$index"
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(2.dp)
                        .background(lineColor)
                )
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val circleColor by animateColorAsState(
                    targetValue = when {
                        index < currentStep -> AppColors.success
                        index == currentStep -> AppColors.brand500
                        else -> AppColors.border
                    },
                    animationSpec = spring(),
                    label = "circle_color_$index"
                )

                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(circleColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (index < currentStep) {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                    } else {
                        Text(
                            text = "${index + 1}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (index == currentStep) Color.White else AppColors.textMuted
                        )
                    }
                }

                Text(
                    text = label,
                    fontSize = 11.sp,
                    fontWeight = if (index == currentStep) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (index <= currentStep) AppColors.textPrimary else AppColors.textMuted
                )
            }
        }
    }
}
