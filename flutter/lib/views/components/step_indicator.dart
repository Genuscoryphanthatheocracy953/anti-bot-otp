import 'package:flutter/material.dart';

import '../theme.dart';

class StepIndicator extends StatelessWidget {
  final int currentStep;

  const StepIndicator({super.key, required this.currentStep});

  static const _labels = ['Phone', 'Verify', 'Done'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
      child: Row(
        children: List.generate(_labels.length * 2 - 1, (index) {
          if (index.isOdd) {
            // Connecting line
            final stepBefore = index ~/ 2;
            final isCompleted = stepBefore < currentStep;
            return Expanded(
              child: Container(
                height: 2,
                color: isCompleted ? AppColors.success : AppColors.border,
              ),
            );
          }
          final step = index ~/ 2;
          return _buildStep(step);
        }),
      ),
    );
  }

  Widget _buildStep(int step) {
    final isCompleted = step < currentStep;
    final isCurrent = step == currentStep;

    Color bgColor;
    Color textColor;
    Widget child;

    if (isCompleted) {
      bgColor = AppColors.success;
      textColor = Colors.white;
      child = const Icon(Icons.check, size: 14, color: Colors.white);
    } else if (isCurrent) {
      bgColor = AppColors.brand500;
      textColor = Colors.white;
      child = Text(
        '${step + 1}',
        style: TextStyle(
          color: textColor,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      );
    } else {
      bgColor = Colors.transparent;
      textColor = AppColors.textMuted;
      child = Text(
        '${step + 1}',
        style: TextStyle(
          color: textColor,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: bgColor,
            border: Border.all(
              color: isCompleted
                  ? AppColors.success
                  : isCurrent
                      ? AppColors.brand500
                      : AppColors.border,
              width: 2,
            ),
          ),
          alignment: Alignment.center,
          child: child,
        ),
        const SizedBox(height: 4),
        Text(
          _labels[step],
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: isCompleted || isCurrent
                ? AppColors.textPrimary
                : AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}
