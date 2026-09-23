"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Results } from "@/features/results";
import { useLocale, type Locale } from "@/lib/i18n";
import { useSimulationContext } from "./SimulationProvider";
import styles from "./routes.module.css";

const messages: Record<Locale, { readonly kicker: string; readonly title: string; readonly text: string; readonly action: string }> = {
  ru: { kicker: "Результат симуляции", title: "Здесь появится отчёт по вашему плану", text: "Оценка не хранится после перезагрузки: вернитесь к решениям и отправьте актуальный набор.", action: "Перейти к решениям" },
  kk: { kicker: "Симуляция нәтижесі", title: "Жоспарыңыздың есебі осы жерде пайда болады", text: "Бағалау бет жаңартылғаннан кейін сақталмайды: шешімдерге оралып, өзекті жиынтықты жіберіңіз.", action: "Шешімдерге өту" },
  en: { kicker: "Simulation result", title: "Your plan report will appear here", text: "An evaluation is not kept after a page reload: return to decisions and submit the current set.", action: "Go to decisions" },
};

export function ResultsPage() {
  const router = useRouter();
  const { state, reset } = useSimulationContext();
  const { locale } = useLocale();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  if (scenario && state.evaluation.status === "success") return <main className={styles.workspace}><Results scenario={scenario} result={state.evaluation.result} submittedChoices={state.evaluation.submittedChoices} onEdit={() => router.push("/decisions")} onReset={() => { reset(); router.push("/decisions"); }} /></main>;
  const copy = messages[locale];
  return <main className={styles.state}><p className={styles.kicker}>{copy.kicker}</p><h1>{copy.title}</h1><p>{copy.text}</p><Button size="lg" onClick={() => router.push("/decisions")}>{copy.action}</Button></main>;
}
