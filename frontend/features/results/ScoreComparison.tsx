import { formatNumber, formatSigned } from "@/lib/format/numbers";
import type { EvaluationVM } from "@/lib/contracts/ui";
import styles from "./results.module.css";

export function ScoreComparison({ result }: { readonly result: EvaluationVM }) {
  return <section className={styles.score} aria-label="Сравнение итогового Score"><p className={styles.eyebrow}>Итоговый Score</p><div className={styles.scoreValues}><strong>{formatNumber(result.baselineScore)}</strong><span aria-hidden="true">→</span><strong>{formatNumber(result.score)}</strong></div><p className={result.scoreDelta !== undefined && result.scoreDelta < 0 ? styles.negative : styles.positive}>Изменение: {formatSigned(result.scoreDelta ?? 0)}</p></section>;
}
