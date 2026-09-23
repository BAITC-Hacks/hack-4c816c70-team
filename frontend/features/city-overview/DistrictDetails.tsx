import { Badge, Metric, cx } from "@/components/ui";
import type { DistrictSummary } from "./district-summary";
import { formatAmount, formatScore, formatShare, plural } from "./format";
import styles from "./city-overview.module.css";

interface DistrictDetailsProps {
  readonly summary: DistrictSummary | null;
  readonly indicatorCount: number;
  readonly criticalThreshold: number;
  readonly headingId: string;
  readonly headingLevel?: 2 | 3;
}

/** Шкала показателей 0–100: только для ширины полосы, значения не изменяются. */
function toPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function DistrictDetails({
  summary,
  indicatorCount,
  criticalThreshold,
  headingId,
  headingLevel = 2,
}: DistrictDetailsProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const SubHeading = headingLevel === 2 ? "h3" : "h4";
  const thresholdLabel = formatAmount(criticalThreshold);

  if (!summary) {
    return (
      <div className={styles.detailsEmpty}>
        <Heading id={headingId} className={styles.detailsTitle}>
          Район не выбран
        </Heading>
        <p className={styles.muted}>
          Выберите район на схеме или в списке ниже. Здесь появятся его {indicatorCount}{" "}
          {plural(indicatorCount, ["исходный показатель", "исходных показателя", "исходных показателей"])}{" "}
          и отметки о значениях ниже порога {thresholdLabel}.
        </p>
      </div>
    );
  }

  const { district, readings, critical } = summary;
  const criticalCount = critical.length;

  return (
    <div className={styles.details}>
      <div className={styles.detailsHead}>
        <Heading id={headingId} className={styles.detailsTitle}>
          {district.name}
        </Heading>
        <div className={styles.detailsMetrics}>
          <Metric size="md" label="Доля населения" value={formatShare(district.populationShare)} />
          {district.score !== undefined ? (
            <Metric size="md" label="Балл района" value={formatScore(district.score)} />
          ) : null}
        </div>
      </div>

      <p className={cx(styles.criticalNote, criticalCount > 0 && styles.criticalNoteAlert)}>
        {criticalCount > 0 ? (
          <>
            <span aria-hidden="true">▼ </span>
            {criticalCount} {plural(criticalCount, ["показатель", "показателя", "показателей"])} ниже
            критического порога {thresholdLabel}:{" "}
            {critical.map((reading) => reading.indicator.name).join(", ")}.
          </>
        ) : (
          <>Ни один показатель не ниже критического порога {thresholdLabel}.</>
        )}
      </p>

      <SubHeading className={styles.readingsTitle}>Исходные показатели, шкала 0–100</SubHeading>
      <ul className={styles.readings} role="list">
        {readings.map(({ indicator, value, isCritical }) => (
          <li key={indicator.id} className={cx(styles.reading, isCritical && styles.readingCritical)}>
            <span className={styles.readingName}>
              <span className={styles.readingId}>{indicator.id}</span>
              {indicator.name}
            </span>
            <span className={styles.readingValue}>
              {isCritical ? (
                <Badge tone="danger" className={styles.readingFlag}>
                  <span aria-hidden="true">▼</span> ниже {thresholdLabel}
                </Badge>
              ) : null}
              <data value={value}>{formatScore(value)}</data>
            </span>
            <span className={styles.readingTrack} aria-hidden="true">
              <span className={styles.readingFill} style={{ width: `${toPercent(value)}%` }} />
              <span
                className={styles.readingThreshold}
                style={{ left: `${toPercent(criticalThreshold)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
