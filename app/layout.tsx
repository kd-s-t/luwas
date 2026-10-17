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

const isLocal = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

export const metadata: Metadata = {
  title: isLocal ? "UGNAI (local)" : "UGNAI",
  description: "UGNAI. Barangay DRRM command center.",
  icons: isLocal
    ? {
        icon: [
          { url: "/favicon-local.ico", sizes: "any" },
          {
            url: "/brand/ugnai-logo.jpg",
            type: "image/jpeg",
            sizes: "512x512",
          },
        ],
        apple: [{ url: "/brand/ugnai-logo.jpg", sizes: "180x180" }],
      }
    : {
        icon: [
          { url: "/favicon.ico", sizes: "any" },
          {
            url: "/brand/ugnai-logo.jpg",
            type: "image/jpeg",
            sizes: "512x512",
          },
        ],
        apple: [{ url: "/brand/ugnai-logo.jpg", sizes: "180x180" }],
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
        <a
          href="#main-content"
          className="sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:m-0 focus:inline-flex focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-xl focus:border focus:border-[var(--border)] focus:bg-[var(--surface)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--foreground)] focus:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus:[clip:auto]"
        >
          Skip to main content
        </a>
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
