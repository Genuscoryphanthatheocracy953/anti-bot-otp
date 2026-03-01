export interface AutomationSignals {
  webdriver: boolean;
  headless: boolean;
  selenium: boolean;
  puppeteer: boolean;
  playwright: boolean;
  plugins_missing: boolean;
  languages_empty: boolean;
}

export function detectAutomation(): AutomationSignals {
  const signals: AutomationSignals = {
    webdriver: false,
    headless: false,
    selenium: false,
    puppeteer: false,
    playwright: false,
    plugins_missing: false,
    languages_empty: false,
  };

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return signals;
  }

  // navigator.webdriver — Selenium/Puppeteer/Playwright all set this
  signals.webdriver = !!navigator.webdriver;

  // Headless Chrome detection
  const ua = navigator.userAgent || '';
  const isChrome = ua.includes('Chrome');
  if (ua.includes('HeadlessChrome') || (isChrome && !(window as any).chrome)) {
    signals.headless = true;
  }

  // Selenium globals
  if (
    (window as any).__selenium_unwrapped !== undefined ||
    (window as any).__webdriver_evaluate !== undefined ||
    (window as any).__driver_evaluate !== undefined
  ) {
    signals.selenium = true;
  }

  // Puppeteer globals
  if ((window as any).__puppeteer_evaluation_script__ !== undefined) {
    signals.puppeteer = true;
  }

  // Playwright globals
  if (
    (window as any).__playwright !== undefined ||
    (window as any).__pw_manual !== undefined
  ) {
    signals.playwright = true;
  }

  // Missing plugins (Chrome should have plugins)
  if (isChrome && navigator.plugins.length === 0) {
    signals.plugins_missing = true;
  }

  // Empty languages
  if (navigator.languages.length === 0) {
    signals.languages_empty = true;
  }

  return signals;
}
