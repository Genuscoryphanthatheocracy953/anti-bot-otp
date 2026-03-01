package com.otppoc.android.views.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing

private data class Defense(val icon: ImageVector, val label: String)

private val defenses = listOf(
    Defense(Icons.Filled.Draw, "HMAC Request Signing"),
    Defense(Icons.Filled.Token, "Preflight Token (120s TTL)"),
    Defense(Icons.Filled.Speed, "Multi-dimensional Rate Limiting"),
    Defense(Icons.Filled.BarChart, "Risk Scoring (0-100)"),
    Defense(Icons.Filled.Hardware, "Proof-of-Work Challenge"),
    Defense(Icons.Filled.VerifiedUser, "Device Attestation"),
    Defense(Icons.Filled.Fingerprint, "Browser Fingerprinting"),
    Defense(Icons.Filled.Lock, "OTP Binding (argon2id)"),
    Defense(Icons.Filled.CropSquare, "Honeypot Traps"),
    Defense(Icons.Filled.Visibility, "Automation Detection"),
    Defense(Icons.Filled.Timer, "Timing Analysis"),
)

@Composable
fun DefenseCard(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.defenseBg, RoundedCornerShape(AppSpacing.cardRadius))
            .border(1.dp, AppColors.defenseBorder, RoundedCornerShape(AppSpacing.cardRadius))
            .padding(AppSpacing.cardPadding),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 2.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Shield,
                contentDescription = null,
                tint = AppColors.defenseIcon,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = "ACTIVE DEFENSES",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.defenseIcon,
                letterSpacing = 1.2.sp
            )
        }

        for (defense in defenses) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(AppColors.brand100, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = defense.icon,
                        contentDescription = null,
                        tint = AppColors.brand500,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Text(
                    text = defense.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.textPrimary
                )
            }
        }
    }
}
