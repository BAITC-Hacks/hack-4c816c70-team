"use client";

import { useLocale, type Locale } from "@/lib/i18n";

const messages: Record<Locale, string> = { ru: "Загружаем приложение…", kk: "Қолданба жүктелуде…", en: "Loading the application…" };

export default function Loading() {
  const { locale } = useLocale();
  return <main style={{ padding: 32 }} aria-live="polite">{messages[locale]}</main>;
}
