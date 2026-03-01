import 'package:flutter/material.dart';

import '../theme.dart';

class _DefenseLayer {
  final IconData icon;
  final String label;

  const _DefenseLayer(this.icon, this.label);
}

class DefenseCard extends StatelessWidget {
  const DefenseCard({super.key});

  static const _layers = [
    _DefenseLayer(Icons.draw, 'HMAC Request Signing'),
    _DefenseLayer(Icons.verified, 'Preflight Token (120s TTL)'),
    _DefenseLayer(Icons.speed, 'Multi-dimensional Rate Limiting'),
    _DefenseLayer(Icons.bar_chart, 'Risk Scoring (0–100)'),
    _DefenseLayer(Icons.construction, 'Proof-of-Work Challenge'),
    _DefenseLayer(Icons.verified_user, 'Device Attestation'),
    _DefenseLayer(Icons.fingerprint, 'Browser Fingerprinting'),
    _DefenseLayer(Icons.lock, 'OTP Binding (argon2id)'),
    _DefenseLayer(Icons.crop_free, 'Honeypot Traps'),
    _DefenseLayer(Icons.smart_toy, 'Automation Detection'),
    _DefenseLayer(Icons.timer, 'Timing Analysis'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.defenseBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: AppColors.defenseBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.shield, color: AppColors.defenseIcon, size: 20),
              const SizedBox(width: 8),
              const Text(
                '11 Defense Layers Active',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ..._layers.map((layer) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.defenseIcon.withValues(alpha: 0.1),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        layer.icon,
                        size: 14,
                        color: AppColors.defenseIcon,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        layer.label,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
