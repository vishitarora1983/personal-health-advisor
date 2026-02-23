// frontend/src/app/layout.tsx
//
// ROOT LAYOUT — applies to ALL routes (public and authenticated)
//
// INTENTIONALLY MINIMAL: This layout contains only what every single route
// in the app needs — the HTML document structure, the global font, and the
// toast notification system. Authentication, sidebar, and profile state are
// scoped to the nested app/layout.tsx which only wraps /app/* routes.
//
// Public routes (/, /login, /signup) render directly inside this layout
// with no auth providers or sidebar — they are fully standalone pages.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Load Inter with all weights used by the type scale.
// display: 'swap' prevents FOIT (flash of invisible text) while still downloading.
// variable: '--font-inter' exposes Inter as a CSS custom property.
const inter = Inter({
  subsets: ["latin"],
  // Load all weights needed by the FedRight type scale
  weight: ["400", "500", "600", "700", "800"],
  // Expose as CSS custom property for use in globals.css and component styles
  variable: "--font-inter",
  // swap prevents FOIT (flash of invisible text) while still downloading
  display: "swap",
});

export const metadata: Metadata = {
  title: "FedRight — One Kitchen. Every Body. Perfectly Fed.",
  description:
    "AI-powered household meal planning for Indian families. Personalized nutrition, smart grocery lists, and family-aware meal planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // inter.variable exposes --font-inter CSS custom property to the entire document
    <html lang="en" className={inter.variable}>
      <body
        className="antialiased"
        style={{
          fontFamily:
            "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/*
          ToastProvider is at root level because BOTH public pages (/login, /signup)
          and authenticated pages (/app/*) need toast notifications.
          For example: login errors, signup success messages.
        */}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
