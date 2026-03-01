package com.otppoc.android.views

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.otppoc.android.ui.theme.AppColors
import com.otppoc.android.ui.theme.AppSpacing
import com.otppoc.android.viewmodels.AuthState
import com.otppoc.android.viewmodels.AuthViewModel
import com.otppoc.android.views.components.DefenseCard
import com.otppoc.android.views.components.StepIndicator

@Composable
fun ContentView(viewModel: AuthViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()

    val currentStep = when (state) {
        is AuthState.PhoneInput, is AuthState.Error -> 0
        is AuthState.RunningPreflight, is AuthState.SolvingPoW,
        is AuthState.SendingOtp, is AuthState.OtpSent,
        is AuthState.VerifyingOtp -> 1
        is AuthState.Authenticated -> 2
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.bg)
    ) {
        // Dark gradient hero header with rounded bottom
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp))
                .background(AppColors.heroGradient),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(top = 8.dp, bottom = 20.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Shield,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = "OTP Auth PoC",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Layered Anti-Bot Defenses",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.sectionGap)
        ) {
            StepIndicator(
                currentStep = currentStep,
                modifier = Modifier.padding(top = AppSpacing.sectionGap)
            )

            AnimatedContent(
                targetState = state,
                transitionSpec = {
                    (slideInHorizontally { it } + fadeIn()) togetherWith
                            (slideOutHorizontally { -it } + fadeOut())
                },
                label = "auth_state"
            ) { targetState ->
                when (targetState) {
                    is AuthState.PhoneInput, is AuthState.Error ->
                        PhoneInputView(viewModel = viewModel)
                    is AuthState.RunningPreflight, is AuthState.SolvingPoW, is AuthState.SendingOtp ->
                        LoadingView(viewModel = viewModel)
                    is AuthState.OtpSent, is AuthState.VerifyingOtp ->
                        OtpVerifyView(viewModel = viewModel)
                    is AuthState.Authenticated ->
                        SessionView(viewModel = viewModel)
                }
            }

            DefenseCard(
                modifier = Modifier.padding(horizontal = 20.dp)
            )
        }
    }
}
