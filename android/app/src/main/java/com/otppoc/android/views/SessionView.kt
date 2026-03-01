package com.otppoc.android.views

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing
import com.otppoc.android.viewmodels.AuthViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SessionView(viewModel: AuthViewModel) {
    val session by viewModel.session.collectAsState()
    var showCheck by remember { mutableStateOf(false) }

    val checkScale by animateFloatAsState(
        targetValue = if (showCheck) 1f else 0.3f,
        animationSpec = spring(
            dampingRatio = 0.6f,
            stiffness = Spring.StiffnessMedium
        ),
        label = "check_scale"
    )
    LaunchedEffect(Unit) {
        showCheck = true
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
            .padding(AppSpacing.cardPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppSpacing.innerGap)
    ) {
        // Animated success checkmark
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .scale(checkScale)
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(AppColors.successBg, CircleShape)
            )
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(AppColors.success, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = "Authenticated",
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        Text(
            text = "Authenticated!",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.textPrimary
        )

        session?.let { s ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            ) {
                SessionInfoRow(Icons.Filled.Phone, "Phone", s.phone)
                HorizontalDivider(modifier = Modifier.padding(start = 44.dp), color = AppColors.border)
                SessionInfoRow(
                    Icons.Filled.Devices, "Device",
                    s.device_id.take(8) + "..."
                )
                HorizontalDivider(modifier = Modifier.padding(start = 44.dp), color = AppColors.border)
                SessionInfoRow(Icons.Filled.CellTower, "Channel", s.channel)
                HorizontalDivider(modifier = Modifier.padding(start = 44.dp), color = AppColors.border)
                SessionInfoRow(Icons.Filled.Schedule, "Issued", formatTimestamp(s.issued_at))
                HorizontalDivider(modifier = Modifier.padding(start = 44.dp), color = AppColors.border)
                SessionInfoRow(Icons.Filled.TimerOff, "Expires", formatTimestamp(s.expires_at))
            }
        }

        OutlinedButton(
            onClick = { viewModel.reset() },
            shape = RoundedCornerShape(AppSpacing.buttonRadius),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = AppColors.textSecondary
            ),
            border = BorderStroke(1.dp, AppColors.border),
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
        ) {
            Text(
                text = "Sign Out",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun SessionInfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = AppColors.brand500,
            modifier = Modifier.size(20.dp)
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.textMuted
            )
            Text(
                text = value,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = AppColors.textPrimary
            )
        }
    }
}

private fun formatTimestamp(ts: Long): String {
    val date = Date(ts * 1000)
    val formatter = SimpleDateFormat("MM/dd/yy, h:mm:ss a", Locale.getDefault())
    return formatter.format(date)
}
