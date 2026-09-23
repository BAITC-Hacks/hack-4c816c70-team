import type { ReactNode } from "react";
import styles from "./Metric.module.css";
import { cx } from "./cx";

export type MetricSize = "display" | "lg" | "md";
export type MetricTone = "default" | "inverse";

export interface MetricProps {
  readonly label: ReactNode;
  /** Уже отформатированное значение. Metric ничего не вычисляет. */
  readonly value: ReactNode;
  readonly unit?: ReactNode;
  readonly caption?: ReactNode;
  readonly size?: MetricSize;
  readonly tone?: MetricTone;
  readonly className?: string;
}

export function Metric({
  label,
  value,
  unit,
  caption,
  size = "lg",
  tone = "default",
  className,
}: MetricProps) {
  return (
    <div className={cx(styles.metric, styles[size], styles[tone], className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </div>
  );
}
