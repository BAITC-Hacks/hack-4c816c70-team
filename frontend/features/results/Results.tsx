"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { ResultsProps } from "@/lib/contracts/ui";
import { formatInteger } from "@/lib/format/numbers";
import { districtName, indicatorName, useLocale } from "@/lib/i18n";
import { DistrictComparison } from "./DistrictComparison";
import { Explanation } from "./Explanation";
import { ScoreComparison } from "./ScoreComparison";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

export function Results({ scenario, result, submittedChoices, onEdit, onReset }: ResultsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { locale, intlLocale } = useLocale();
  const copy = resultMessages[locale];

  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  const spent = formatInteger(result.spent, intlLocale);
  const budget = formatInteger(scenario.budget, intlLocale);
  return <section className={styles.results} aria-labelledby="results-title"><header className={styles.header}><div><p className={styles.eyebrow}>{copy.eyebrow}</p><h1 id="results-title" ref={headingRef} tabIndex={-1}>{copy.heading}</h1><p className={styles.headerLead}>{copy.submitted(submittedChoices.length, scenario.rules?.requiredChoices ?? submittedChoices.length, scenario.horizonQuarters)}</p></div><div className={styles.actions}><Button onClick={onEdit}>{copy.edit}</Button><Button variant="secondary" onClick={onReset}>{copy.reset}</Button></div></header><div className={styles.topGrid}><ScoreComparison result={result} /><section className={styles.budget}><p className={styles.eyebrow}>{copy.finalBudget}</p><h2><strong>{spent}</strong><span> / {budget}</span></h2><div className={styles.budgetBar} aria-label={copy.budgetAria(spent, budget)}><span style={{ width: `${Math.min(100, Math.max(0, scenario.budget === 0 ? 0 : result.spent / scenario.budget * 100))}%` }} /></div><p>{copy.remaining(formatInteger(result.remaining, intlLocale))}</p></section></div><DistrictComparison scenario={scenario} districts={result.districts} />{result.appliedSynergies.length > 0 ? <section className={styles.synergies}><h2>{copy.synergies}</h2><ul>{result.appliedSynergies.map((item) => <li key={`${item.measureIds.join("-")}-${item.districtId}`}>{item.measureIds.join(" + ")} · {districtName(item.districtId, locale, scenario.districts.find((district) => district.id === item.districtId)?.name ?? item.districtId)}: {indicatorName(item.indicatorId, locale, item.indicatorId)} {item.delta > 0 ? "+" : ""}{formatInteger(item.delta, intlLocale)}</li>)}</ul></section> : null}<Explanation explanation={result.explanation} source={result.explanationSource} /></section>;
}
