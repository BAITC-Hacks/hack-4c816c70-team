"use client";

import { useEffect, useRef } from "react";
import type { ResultsProps } from "@/lib/contracts/ui";
import { formatInteger } from "@/lib/format/numbers";
import { DistrictComparison } from "./DistrictComparison";
import { Explanation } from "./Explanation";
import { ScoreComparison } from "./ScoreComparison";
import styles from "./results.module.css";

export function Results({ scenario, result, onEdit, onReset }: ResultsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  return <section className={styles.results} aria-labelledby="results-title"><header className={styles.header}><div><p className={styles.eyebrow}>Результат симуляции</p><h1 id="results-title" ref={headingRef} tabIndex={-1}>Ваш план оценён</h1></div><div className={styles.actions}><button type="button" onClick={onEdit}>Изменить решения</button><button type="button" onClick={onReset}>Начать заново</button></div></header><div className={styles.topGrid}><ScoreComparison result={result} /><section className={styles.budget}><h2>Финальный бюджет</h2><p><strong>{formatInteger(result.spent)}</strong> потрачено из {formatInteger(scenario.budget)}</p><p>Остаток: <strong>{formatInteger(result.remaining)}</strong></p></section></div><DistrictComparison scenario={scenario} districts={result.districts} />{result.appliedSynergies.length > 0 ? <section className={styles.synergies}><h2>Применённые синергии</h2><ul>{result.appliedSynergies.map((item) => <li key={`${item.measureIds.join("-")}-${item.districtId}`}>{item.measureIds.join(" + ")} · {scenario.districts.find((district) => district.id === item.districtId)?.name ?? item.districtId}: {item.indicatorId} {item.delta > 0 ? "+" : ""}{formatInteger(item.delta)}</li>)}</ul></section> : null}<Explanation explanation={result.explanation} source={result.explanationSource} /></section>;
}
