import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { clerkAppearance } from "@/src/lib/clerk-appearance";
import "./globals.css";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "TripleKeel — Get better at your job on autopilot",
  description:
    "A personal coach for knowledge work. Spot your strengths and find one small thing to practice next, with prompt scoring that stays on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

import type { ReactNode } from "react";
