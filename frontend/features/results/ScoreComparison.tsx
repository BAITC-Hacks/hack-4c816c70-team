import { formatNumber, formatSigned } from "@/lib/format/numbers";
import type { EvaluationVM } from "@/lib/contracts/ui";
import styles from "./results.module.css";

export function ScoreComparison({ result }: { readonly result: EvaluationVM }) {
  const before = Math.min(100, Math.max(0, result.baselineScore));
  const after = Math.min(100, Math.max(0, result.score));
  return <section className={styles.score} aria-label="Сравнение итогового Score"><p className={styles.eyebrow}>Итоговый Score</p><div className={styles.scoreValues}><strong>{formatNumber(result.baselineScore)}</strong><span aria-hidden="true">→</span><strong>{formatNumber(result.score)}</strong></div><div className={styles.scoreBars} aria-label={`Score: ${formatNumber(result.baselineScore)} до, ${formatNumber(result.score)} после`}><div><span>До</span><i><b style={{ width: `${before}%` }} /></i></div><div><span>После</span><i><b style={{ width: `${after}%` }} /></i></div></div><p className={result.scoreDelta !== undefined && result.scoreDelta < 0 ? styles.negative : styles.positive}>Изменение: {formatSigned(result.scoreDelta ?? 0)}</p></section>;
}
