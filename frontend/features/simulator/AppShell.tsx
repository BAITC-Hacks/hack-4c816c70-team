"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader, ThemeSwitcher } from "@/components/ui";
import { SimulationProvider, useSimulationContext } from "./SimulationProvider";

const steps = [
  { id: "home", label: "Обзор", href: "/" },
  { id: "decisions", label: "Решения", href: "/decisions" },
  { id: "results", label: "Результат", href: "/results" },
] as const;

function Navigation() {
  const pathname = usePathname();
  const { state } = useSimulationContext();
  const hasResult = state.evaluation.status === "success";
  const activeStepId = pathname === "/decisions" ? "decisions" : pathname === "/results" ? "results" : "home";
  return <AppHeader title="Аким на 5 часов" titleHref="/" activeStepId={activeStepId} steps={steps.map((step) => ({ ...step, disabled: step.id === "results" && !hasResult, disabledReason: step.id === "results" && !hasResult ? "Появится после оценки решений" : undefined }))} end={<ThemeSwitcher />} />;
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  return <SimulationProvider><Navigation />{children}</SimulationProvider>;
}
