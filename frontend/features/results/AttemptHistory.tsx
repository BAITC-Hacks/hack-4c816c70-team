import type { ChoiceDraft, EvaluationAttemptVM, ScenarioVM } from "@/lib/contracts/ui";
import { formatInteger, formatNumber, formatSigned } from "@/lib/format/numbers";
import { districtName, measureName, useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

const pairKey = (choice: ChoiceDraft) => `${choice.measureId}@${choice.districtId ?? ""}`;
/** Display-only difference of two API values already rounded to hundredths. */
const difference = (current: number, previous: number) => Math.round((current - previous) * 100) / 100;
const signedInteger = (value: number, locale: Parameters<typeof formatInteger>[1]) => `${value > 0 ? "+" : ""}${formatInteger(value, locale)}`;

export function AttemptHistory({ scenario, history }: { readonly scenario: ScenarioVM; readonly history: readonly EvaluationAttemptVM[] }) {
  const { locale, intlLocale } = useLocale();
  const copy = resultMessages[locale].attempts;
  const current = history.at(-1);
  if (!current) return null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

  const measures = (attempt: EvaluationAttemptVM, other: EvaluationAttemptVM | null) => {
    const otherPairs = new Set(other?.submittedChoices.map(pairKey));
    return <ol className={styles.attemptMeasures}>{attempt.submittedChoices.map((choice) => {
      const measure = scenario.measures.find((item) => item.id === choice.measureId);
      const district = choice.districtId ? districtName(choice.districtId, locale, scenario.districts.find((item) => item.id === choice.districtId)?.name ?? choice.districtId) : copy.wholeCity;
      const changed = other !== null && !otherPairs.has(pairKey(choice));
      return <li key={choice.measureId} data-changed={changed || undefined}><b>{choice.measureId}</b><span>{measureName(choice.measureId, locale, measure?.name ?? choice.measureId)}</span><span className={styles.attemptDistrict}>{district}</span>{changed ? <em>{copy.onlyHere}</em> : null}</li>;
    })}</ol>;
  };

  if (!previous) return <section className={styles.attempts} aria-labelledby="attempt-measures-title"><h2 id="attempt-measures-title">{copy.currentMeasures}</h2>{measures(current, null)}</section>;

  const scoreRow = (label: string, now: number, before: number, tone: boolean) => {
    const delta = difference(now, before);
    return <tr key={label}><th scope="row">{label}</th><td>{formatNumber(before, intlLocale)}</td><td>{formatNumber(now, intlLocale)}</td><td className={tone ? (delta < 0 ? styles.negative : delta > 0 ? styles.positive : undefined) : undefined}>{formatSigned(delta, intlLocale)}</td></tr>;
  };
  const unitRow = (label: string, now: number, before: number) => <tr key={label}><th scope="row">{label}</th><td>{formatInteger(before, intlLocale)}</td><td>{formatInteger(now, intlLocale)}</td><td>{signedInteger(now - before, intlLocale)}</td></tr>;
  const districtRows = scenario.districts.flatMap((district) => {
    const before = previous.result.districts.find((item) => item.id === district.id);
    const now = current.result.districts.find((item) => item.id === district.id);
    return before && now ? [scoreRow(districtName(district.id, locale, district.name), now.scoreAfter, before.scoreAfter, true)] : [];
  });

  const scoreGain = difference(current.result.score, previous.result.score);
  return <section className={styles.attempts} aria-labelledby="attempt-comparison-title">
    <h2 id="attempt-comparison-title">{copy.comparisonTitle}</h2>
    <p className={styles.attemptNote}>{copy.comparisonNote}</p>
    <p className={styles.attemptVerdict}>{scoreGain > 0 ? copy.scoreUp(formatNumber(scoreGain, intlLocale)) : scoreGain === 0 ? copy.scoreSame : copy.scoreDown(formatNumber(-scoreGain, intlLocale))}</p>
    <table className={styles.attemptTable}>
      <thead><tr><th scope="col">{copy.metric}</th><th scope="col">{copy.previous}</th><th scope="col">{copy.current}</th><th scope="col">{copy.difference}</th></tr></thead>
      <tbody>
        {scoreRow(copy.score, current.result.score, previous.result.score, true)}
        {unitRow(copy.spent, current.result.spent, previous.result.spent)}
        {unitRow(copy.remaining, current.result.remaining, previous.result.remaining)}
      </tbody>
      <tbody><tr><th scope="colgroup" colSpan={4} className={styles.attemptGroup}>{copy.districtScores}</th></tr>{districtRows}</tbody>
    </table>
    <h3>{copy.measures}</h3>
    <div className={styles.attemptColumns}>
      <div><h4>{copy.previous}</h4>{measures(previous, current)}</div>
      <div><h4>{copy.current}</h4>{measures(current, previous)}</div>
    </div>
  </section>;
}
