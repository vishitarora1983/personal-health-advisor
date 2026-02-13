import type { Metadata } from "next";
import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { ProfileProvider } from "@/lib/ProfileContext";

const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "AI Meal Planner - Your Personal Health Advisor",
  description:
    "AI-powered meal planning with personalized nutrition tracking and grocery lists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} antialiased`}
        style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
      >
        <ToastProvider>
          <ProfileProvider>
            <Sidebar />
            <main className="min-h-screen lg:ml-64">
              <div className="mx-auto px-4 pt-16 pb-8 lg:px-8 lg:pt-8 max-w-7xl">
                {children}
              </div>
            </main>
          </ProfileProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
