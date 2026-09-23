"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Results } from "@/features/results";
import { useLocale, type Locale } from "@/lib/i18n";
import { useSimulationContext } from "./SimulationProvider";
import styles from "./routes.module.css";

const messages: Record<Locale, { readonly kicker: string; readonly title: string; readonly text: string; readonly action: string; readonly retryError: string; readonly retry: string }> = {
  ru: { kicker: "Результат симуляции", title: "Здесь появится отчёт по вашему плану", text: "Оценка не хранится после перезагрузки: вернитесь к решениям и отправьте актуальный набор.", action: "Перейти к решениям", retryError: "Не удалось обновить объяснение. Предыдущий результат сохранён.", retry: "Повторить попытку" },
  kk: { kicker: "Симуляция нәтижесі", title: "Жоспарыңыздың есебі осы жерде пайда болады", text: "Бағалау бет жаңартылғаннан кейін сақталмайды: шешімдерге оралып, өзекті жиынтықты жіберіңіз.", action: "Шешімдерге өту", retryError: "Түсіндірмені жаңарту мүмкін болмады. Алдыңғы нәтиже сақталды.", retry: "Қайталап көру" },
  en: { kicker: "Simulation result", title: "Your plan report will appear here", text: "An evaluation is not kept after a page reload: return to decisions and submit the current set.", action: "Go to decisions", retryError: "Could not update the explanation. Your previous result has been kept.", retry: "Try again" },
};

export function ResultsPage() {
  const router = useRouter();
  const { state, reset, evaluate } = useSimulationContext();
  const { locale } = useLocale();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  // A re-evaluation started from this page keeps the previous report visible until the new one arrives.
  const [shown, setShown] = useState<Extract<typeof state.evaluation, { status: "success" }> | null>(null);
  if (state.evaluation.status === "success" && state.evaluation !== shown) setShown(state.evaluation);
  const retainPrevious = (state.evaluation.status === "pending" || state.evaluation.status === "error") && shown?.revision === state.revision;
  if (state.evaluation.status !== "success" && !retainPrevious && shown !== null) setShown(null);
  const evaluation = state.evaluation.status === "success" ? state.evaluation : retainPrevious ? shown : null;
  const copy = messages[locale];
  // Re-evaluation reuses the submitted choices (state.choices equals them while a result is shown) and the current UI language.
  if (scenario && evaluation) return <main className={styles.workspace}>{state.evaluation.status === "error" ? <section role="alert"><p>{copy.retryError}</p><Button onClick={() => void evaluate()}>{copy.retry}</Button></section> : null}<Results scenario={scenario} result={evaluation.result} submittedChoices={evaluation.submittedChoices} onEdit={() => router.push("/decisions")} onReset={() => { reset(); router.push("/decisions"); }} onReevaluate={() => void evaluate()} isReevaluating={state.evaluation.status === "pending"} /></main>;
  return <main className={styles.state}><p className={styles.kicker}>{copy.kicker}</p><h1>{copy.title}</h1><p>{copy.text}</p><Button size="lg" onClick={() => router.push("/decisions")}>{copy.action}</Button></main>;
}
