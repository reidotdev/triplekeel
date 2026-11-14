import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

export const clerkAppearance = {
  variables: {
    colorBackground: "var(--background)",
    colorForeground: "var(--foreground)",
    colorInput: "var(--foreground)",
    colorNeutral: "var(--muted)",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--focus)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-family)",
  },
} satisfies NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
