package com.otppoc.android.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing
import com.otppoc.android.viewmodels.AuthState
import com.otppoc.android.viewmodels.AuthViewModel

@Composable
fun OtpVerifyView(viewModel: AuthViewModel) {
    val state by viewModel.state.collectAsState()
    val otpCode by viewModel.otpCode.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()
    val isVerifying = state is AuthState.VerifyingOtp
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
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
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Enter OTP Code",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.textPrimary
            )
            Text(
                text = "Check Telegram or backend console for the 6-digit code.",
                fontSize = 13.sp,
                color = AppColors.textSecondary,
                textAlign = TextAlign.Center
            )
        }

        OutlinedTextField(
            value = otpCode,
            onValueChange = { viewModel.updateOtpCode(it) },
            placeholder = {
                Text(
                    "000000",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.textMuted
                )
            },
            textStyle = TextStyle(
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                textAlign = TextAlign.Center,
                letterSpacing = 8.sp
            ),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            shape = RoundedCornerShape(AppSpacing.inputRadius),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AppColors.brand500,
                unfocusedBorderColor = AppColors.border,
                focusedContainerColor = AppColors.surface,
                unfocusedContainerColor = AppColors.surface
            ),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
        )

        Button(
            onClick = { viewModel.verifyOtp() },
            enabled = otpCode.length == 6 && !isVerifying,
            shape = RoundedCornerShape(AppSpacing.buttonRadius),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.brand500,
                disabledContainerColor = AppColors.textMuted
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(AppSpacing.buttonHeight)
        ) {
            if (isVerifying) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = if (isVerifying) "Verifying..." else "Verify OTP",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }

        if (statusMessage.isNotEmpty()) {
            Text(
                text = statusMessage,
                fontSize = 13.sp,
                color = AppColors.textSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
