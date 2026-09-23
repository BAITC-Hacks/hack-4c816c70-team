"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Planner } from "@/features/planner";
import { useLocale, type Locale } from "@/lib/i18n";
import { useSimulationContext } from "./SimulationProvider";
import { formatSimulationError } from "./error-messages";
import styles from "./routes.module.css";

const messages: Record<Locale, { readonly loading: string; readonly failed: string; readonly retry: string; readonly home: string }> = {
  ru: { loading: "Загружаем каталог решений…", failed: "Не удалось загрузить каталог", retry: "Повторить загрузку", home: "Вернуться к обзору" },
  kk: { loading: "Шешімдер каталогы жүктелуде…", failed: "Каталогты жүктеу мүмкін болмады", retry: "Қайта жүктеу", home: "Шолуға оралу" },
  en: { loading: "Loading the decisions catalogue…", failed: "Could not load the catalogue", retry: "Try again", home: "Return to overview" },
};

export function DecisionsPage() {
  const router = useRouter();
  const { state, setChoices, evaluate, loadScenario } = useSimulationContext();
  const { locale } = useLocale();
  const copy = messages[locale];
  if (state.scenario.status === "loading") return <main className={styles.state} aria-live="polite"><h1>{copy.loading}</h1></main>;
  if (state.scenario.status === "error") return <main className={styles.state} role="alert"><h1>{copy.failed}</h1><p>{formatSimulationError(state.scenario.error, locale)}</p><Button onClick={() => void loadScenario()}>{copy.retry}</Button><Link href="/">{copy.home}</Link></main>;
  return <main className={styles.workspace}><Planner scenario={state.scenario.scenario} choices={state.choices} preferredDistrictId={state.selectedDistrictId} isEvaluating={state.evaluation.status === "pending"} serverError={state.evaluation.status === "error" ? formatSimulationError(state.evaluation.error, locale) : null} onChoicesChange={setChoices} onEvaluate={() => void evaluate()} onBack={() => router.push("/")} /></main>;
}
