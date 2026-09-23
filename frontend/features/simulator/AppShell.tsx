"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader, LanguageSwitcher, ThemeSwitcher } from "@/components/ui";
import { useLocale, type Locale } from "@/lib/i18n";
import { SimulationProvider, useSimulationContext } from "./SimulationProvider";

const messages: Record<Locale, { readonly title: string; readonly steps: readonly [string, string, string]; readonly unavailable: string }> = {
  ru: { title: "Аким на 5 часов", steps: ["Обзор", "Решения", "Результат"], unavailable: "Появится после оценки решений" },
  kk: { title: "5 сағаттық әкім", steps: ["Шолу", "Шешімдер", "Нәтиже"], unavailable: "Шешімдер бағаланғаннан кейін ашылады" },
  en: { title: "Akim for 5 Hours", steps: ["Overview", "Decisions", "Results"], unavailable: "Available after evaluating decisions" },
};

function Navigation() {
  const pathname = usePathname();
  const { state } = useSimulationContext();
  const { locale } = useLocale();
  const copy = messages[locale];
  const hasResult = state.evaluation.status === "success";
  const activeStepId = pathname === "/decisions" ? "decisions" : pathname === "/results" ? "results" : "home";
  const steps = [
    { id: "home", label: copy.steps[0], href: "/" },
    { id: "decisions", label: copy.steps[1], href: "/decisions" },
    { id: "results", label: copy.steps[2], href: "/results" },
  ] as const;
  return <AppHeader title={copy.title} titleHref="/" activeStepId={activeStepId} steps={steps.map((step) => ({ ...step, disabled: step.id === "results" && !hasResult, disabledReason: step.id === "results" && !hasResult ? copy.unavailable : undefined }))} end={<><LanguageSwitcher /><ThemeSwitcher /></>} />;
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  return <SimulationProvider><Navigation />{children}</SimulationProvider>;
}
