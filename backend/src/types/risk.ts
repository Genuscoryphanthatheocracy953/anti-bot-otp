export interface ClientSignals {
  honeypot_name?: string;
  honeypot_email?: string;
  honeypot_url?: string;
  automation_signals?: {
    webdriver?: boolean;
    headless?: boolean;
    selenium?: boolean;
    puppeteer?: boolean;
    playwright?: boolean;
    plugins_missing?: boolean;
    languages_empty?: boolean;
    // Mobile signals
    jailbroken?: boolean;
    debugger_attached?: boolean;
    suspicious_dylibs?: boolean;
    // Android-specific extended signals
    rooted?: boolean;
    suspicious_libs?: boolean;
    emulator?: boolean;
    ui_automation?: boolean;
    hooking_framework?: boolean;
    screen_reader_abuse?: boolean;
    overlay_detected?: boolean;
  };
  timing?: {
    page_load_ts: number;
    first_interaction_ts?: number;
    form_submit_ts: number;
  };
}

export interface RiskFactors {
  velocity: number;
  datacenterIp: number;
  abnormalHeaders: number;
  failedPow: number;
  failedCaptcha: number;
  failedAttestation: number;
  devicePhoneMismatch: number;
  honeypotTriggered: number;
  automationDetected: number;
  suspiciousTiming: number;
}

export interface RiskContext {
  ip: string;
  subnet: string;
  deviceId: string;
  channel: 'web' | 'mobile';
  userAgent?: string;
  acceptLanguage?: string;
  fingerprint?: string;
  phone?: string;
  clientSignals?: ClientSignals;
}
