package com.otppoc.android.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing
import com.otppoc.android.viewmodels.AuthState
import com.otppoc.android.viewmodels.AuthViewModel

@Composable
fun PhoneInputView(viewModel: AuthViewModel) {
    val state by viewModel.state.collectAsState()
    val phone by viewModel.phone.collectAsState()

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
        verticalArrangement = Arrangement.spacedBy(AppSpacing.innerGap)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Enter your phone number",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.textPrimary
            )
            Text(
                text = "We'll send a one-time code to verify your identity.",
                fontSize = 13.sp,
                color = AppColors.textSecondary
            )
        }

        OutlinedTextField(
            value = phone,
            onValueChange = {
                viewModel.updatePhone(it)
                viewModel.recordInteraction()
            },
            placeholder = {
                Text("+1 555 123 4567", color = AppColors.textMuted)
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Phone,
                    contentDescription = null,
                    tint = AppColors.textMuted,
                    modifier = Modifier.size(20.dp)
                )
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            singleLine = true,
            shape = RoundedCornerShape(AppSpacing.inputRadius),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AppColors.brand500,
                unfocusedBorderColor = AppColors.border,
                focusedContainerColor = AppColors.surface,
                unfocusedContainerColor = AppColors.surface
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = { viewModel.startAuth() },
            enabled = phone.isNotEmpty(),
            shape = RoundedCornerShape(AppSpacing.buttonRadius),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.brand500,
                disabledContainerColor = AppColors.textMuted
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(AppSpacing.buttonHeight)
        ) {
            Text(
                text = "Send OTP",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }

        // Error banner
        if (state is AuthState.Error) {
            val errorMessage = (state as AuthState.Error).message
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        AppColors.errorBg,
                        RoundedCornerShape(AppSpacing.inputRadius)
                    )
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.Top
            ) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = AppColors.error,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = errorMessage,
                    fontSize = 13.sp,
                    color = AppColors.error,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}
