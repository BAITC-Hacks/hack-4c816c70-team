"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Results } from "@/features/results";
import { useSimulationContext } from "./SimulationProvider";
import styles from "./routes.module.css";

export function ResultsPage() {
  const router = useRouter();
  const { state, reset } = useSimulationContext();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  if (scenario && state.evaluation.status === "success") return <main className={styles.workspace}><Results scenario={scenario} result={state.evaluation.result} submittedChoices={state.evaluation.submittedChoices} onEdit={() => router.push("/decisions")} onReset={() => { reset(); router.push("/decisions"); }} /></main>;
  return <main className={styles.state}><p className={styles.kicker}>Результат симуляции</p><h1>Здесь появится отчёт по вашему плану</h1><p>Оценка не хранится после перезагрузки: вернитесь к решениям и отправьте актуальный набор.</p><Button size="lg" onClick={() => router.push("/decisions")}>Перейти к решениям</Button></main>;
}
