import type { Metadata } from "next";
import { ThemeProvider, themeBootstrapScript } from "@/components/ui";
import { AppShell } from "@/features/simulator/AppShell";
import { LocaleProvider } from "@/lib/i18n";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Аким на 5 часов",
  description: "AI-симулятор городских решений для Astana Innovations",
  icons: {
    icon: [
      { url: "/favicon.ico?v=akim-logo-1", sizes: "16x16 32x32 48x48" },
      { url: "/city/akim-logo.svg?v=1", type: "image/svg+xml" },
    ],
    apple: "/city/akim-logo.png?v=1",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} /></head>
      <body><LocaleProvider><ThemeProvider><AppShell>{children}</AppShell></ThemeProvider></LocaleProvider></body>
    </html>
  );
}
