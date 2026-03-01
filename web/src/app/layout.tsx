import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OTP PoC — Anti-Bot Auth',
  description: 'Proof of concept: OTP authentication with anti-bot defenses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        margin: 0,
        padding: 0,
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
      }}>
        <div style={{
          maxWidth: 440,
          margin: '0 auto',
          minHeight: '100vh',
        }}>
          {children}
        </div>
      </body>
    </html>
  );
}
