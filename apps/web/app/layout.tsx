import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { clerkAppearance } from "@/src/lib/clerk-appearance";
import "./globals.css";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "TripleKeel",
  description: "A personal coach for knowledge work.",
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
