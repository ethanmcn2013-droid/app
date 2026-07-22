"use client";

import { ClerkProvider } from "@clerk/nextjs";

/** Identity runtime mounted only by authenticated or auth-aware surfaces. */
export function ClerkRuntimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorBackground: "#ffffff",
          colorForeground: "#14151a",
          fontFamily: "var(--font-geist-sans)",
          borderRadius: "0.5rem",
        },
        elements: {
          formFieldInput: "!min-h-[48px] !text-[16px]",
          formButtonPrimary:
            "bg-ink hover:bg-ink-soft text-white rounded-full !min-h-[48px] !text-[15px]",
          socialButtonsBlockButton: "!min-h-[48px] !text-[15px]",
          socialButtonsBlockButtonText: "!text-[15px]",
          card: "shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
