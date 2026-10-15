import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { CitizenPresenceSync } from "@/components/CitizenPresenceSync";
import { ScenarioProvider } from "@/lib/scenarios/ScenarioProvider";
import { PageTransition } from "@/components/motion/PageTransition";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LUWAS",
  description:
    "LUWAS — Logistics & Unified Workflow for Aid & Safety. Barangay DRRM command center.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/luwas-logo.png", type: "image/png", sizes: "512x512" },
      { url: "/brand/luwas-logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        <AuthProvider>
          <CitizenPresenceSync />
          <ScenarioProvider>
            <PageTransition>{children}</PageTransition>
          </ScenarioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
