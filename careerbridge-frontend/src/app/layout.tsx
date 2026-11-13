import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ShellGate } from "@/components/shell-gate";
import { SmoothScroll } from "@/components/smooth-scroll";
import { AssistantPopup } from "@/components/assistant/assistant-popup";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "CareerBridge — Academia–Industry Collaboration Portal",
  description:
    "SIH26044 | Connect students, universities, and companies through skill mapping, internship discovery, and placement analytics.",
  keywords: ["internship", "placement", "skill mapping", "academia", "industry", "CareerBridge"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${interTight.className} ${display.variable}`}>
        <ThemeProvider>
          {/* reads the URL, so it needs its own boundary or dynamic routes can't prerender */}
          <Suspense fallback={null}>
            <SmoothScroll />
          </Suspense>
          <TooltipProvider>
            <AuthProvider>
              <Suspense fallback={null}>
                <ShellGate>{children}</ShellGate>
              </Suspense>
              {/* its own boundary: Bridge hydrates on its own, so tapping it while a page is still loading can't stall that page */}
              <Suspense fallback={null}>
                <AssistantPopup />
              </Suspense>
            </AuthProvider>
            <Toaster position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
