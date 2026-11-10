import type { Metadata } from "next";
import { AppProviders } from "@/components/shared/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintSahyogi",
  description: "A private, browser-based workspace for everyday file tools."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><AppProviders>{children}</AppProviders></body></html>;
}

