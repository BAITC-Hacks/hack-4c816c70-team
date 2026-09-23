import type { Metadata } from "next";
import { ThemeProvider, themeBootstrapScript } from "@/components/ui";
import { AppShell } from "@/features/simulator/AppShell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Аким на 5 часов",
  description: "AI-симулятор городских решений для Astana Innovations",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} /></head>
      <body><ThemeProvider><AppShell>{children}</AppShell></ThemeProvider></body>
    </html>
  );
}
