"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { ResultsProps } from "@/lib/contracts/ui";
import { formatInteger } from "@/lib/format/numbers";
import { DistrictComparison } from "./DistrictComparison";
import { Explanation } from "./Explanation";
import { ScoreComparison } from "./ScoreComparison";
import styles from "./results.module.css";

export function Results({ scenario, result, submittedChoices, onEdit, onReset }: ResultsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  return <section className={styles.results} aria-labelledby="results-title"><header className={styles.header}><div><p className={styles.eyebrow}>Результат симуляции</p><h1 id="results-title" ref={headingRef} tabIndex={-1}>Ваш план оценён</h1><p className={styles.headerLead}>{submittedChoices.length} из {scenario.rules?.requiredChoices ?? submittedChoices.length} решений отправлены на сервер и рассчитаны для горизонта {scenario.horizonQuarters} кварталов.</p></div><div className={styles.actions}><Button onClick={onEdit}>Изменить решения</Button><Button variant="secondary" onClick={onReset}>Начать заново</Button></div></header><div className={styles.topGrid}><ScoreComparison result={result} /><section className={styles.budget}><p className={styles.eyebrow}>Финальный бюджет</p><h2><strong>{formatInteger(result.spent)}</strong><span> / {formatInteger(scenario.budget)}</span></h2><div className={styles.budgetBar} aria-label={`Потрачено ${formatInteger(result.spent)} из ${formatInteger(scenario.budget)}`}><span style={{ width: `${Math.min(100, Math.max(0, scenario.budget === 0 ? 0 : result.spent / scenario.budget * 100))}%` }} /></div><p>Остаток: <strong>{formatInteger(result.remaining)}</strong> ед.</p></section></div><DistrictComparison scenario={scenario} districts={result.districts} />{result.appliedSynergies.length > 0 ? <section className={styles.synergies}><h2>Применённые синергии</h2><ul>{result.appliedSynergies.map((item) => <li key={`${item.measureIds.join("-")}-${item.districtId}`}>{item.measureIds.join(" + ")} · {scenario.districts.find((district) => district.id === item.districtId)?.name ?? item.districtId}: {item.indicatorId} {item.delta > 0 ? "+" : ""}{formatInteger(item.delta)}</li>)}</ul></section> : null}<Explanation explanation={result.explanation} source={result.explanationSource} /></section>;
}
