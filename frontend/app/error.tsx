"use client";

import { useLocale, type Locale } from "@/lib/i18n";

const messages: Record<Locale, { readonly title: string; readonly text: string; readonly retry: string }> = {
  ru: { title: "Не удалось открыть приложение", text: "Попробуйте обновить страницу.", retry: "Повторить" },
  kk: { title: "Қолданбаны ашу мүмкін болмады", text: "Бетті жаңартып көріңіз.", retry: "Қайталау" },
  en: { title: "Could not open the application", text: "Try refreshing the page.", retry: "Try again" },
};

export default function GlobalError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  const { locale } = useLocale();
  const copy = messages[locale];
  return <main style={{ padding: 32 }}><h1>{copy.title}</h1><p>{copy.text}</p><button type="button" onClick={reset}>{copy.retry}</button></main>;
}
