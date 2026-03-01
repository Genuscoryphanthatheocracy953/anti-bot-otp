import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'view_models/auth_view_model.dart';
import 'views/content_view.dart';
import 'views/theme.dart';

void main() {
  runApp(const OtpPocApp());
}

class OtpPocApp extends StatelessWidget {
  const OtpPocApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthViewModel(),
      child: MaterialApp(
        title: 'OTP Auth PoC',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          scaffoldBackgroundColor: AppColors.bg,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.brand500,
            surface: AppColors.surface,
          ),
          fontFamily: '.SF Pro Text',
        ),
        home: const ContentView(),
      ),
    );
  }
}
