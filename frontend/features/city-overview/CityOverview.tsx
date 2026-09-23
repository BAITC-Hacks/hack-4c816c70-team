"use client";

import { useId } from "react";
import type { CityOverviewProps } from "@/lib/contracts/ui";
import { Badge, Button, Metric, cx } from "@/components/ui";
import { DistrictExplorer } from "./DistrictExplorer";
import { formatAmount, formatScore, plural } from "./format";
import styles from "./city-overview.module.css";

/**
 * Обзор исходного состояния города. Все значения приходят из scenario;
 * компонент не хранит выбор района, не меняет choices и не делает запросов.
 */
export function CityOverview({
  scenario,
  selectedDistrictId,
  onSelectDistrict,
  onStartPlanning,
}: CityOverviewProps) {
  const uid = useId();
  const titleId = `${uid}-title`;

  const { budget, horizonQuarters, criticalThreshold, baselineScore, districts } = scenario;
  const selectedDistrict = districts.find((district) => district.id === selectedDistrictId) ?? null;
  const thresholdLabel = formatAmount(criticalThreshold);
  const requiredChoices = scenario.rules?.requiredChoices;

  return (
    <section className={styles.overview} aria-labelledby={titleId}>
      <header className={styles.hero}>
        <div className={styles.heroIntro}>
          <h1 id={titleId} className={styles.heroTitle}>
            Город до ваших решений
          </h1>
          <p className={styles.heroLead}>
            Исходное состояние {districts.length}{" "}
            {plural(districts.length, ["района", "районов", "районов"])}.{" "}
            {requiredChoices !== undefined
              ? `Выберите ${requiredChoices} ${plural(requiredChoices, ["меру", "меры", "мер"])} в пределах бюджета, затем сервер оценит их эффект.`
              : "Выберите меры в пределах бюджета, затем сервер оценит их эффект."}
          </p>
          {scenario.source === "fixture" ? (
            <Badge tone="warning" className={styles.sourceBadge}>
              Демонстрационные данные, не ответ API
            </Badge>
          ) : null}
        </div>
        <div className={styles.heroMetrics} role="group" aria-label="Исходные параметры сценария">
          <div className={cx(styles.heroMetric, styles.heroMetricScore)}>
              <Metric
                className={styles.heroMetricBody}
                size="display"
                label="Базовый Score"
                value={formatScore(baselineScore)}
                caption="Оценка города до решений"
              />
          </div>
          <div className={styles.heroMetric}>
              <Metric className={styles.heroMetricBody} size="lg" label="Бюджет" value={formatAmount(budget)} unit="ед." />
          </div>
          <div className={styles.heroMetric}>
              <Metric
                className={styles.heroMetricBody}
                size="lg"
                label="Горизонт"
                value={formatAmount(horizonQuarters)}
                unit={plural(horizonQuarters, ["квартал", "квартала", "кварталов"])}
              />
          </div>
          <div className={styles.heroMetric}>
              <Metric
                className={styles.heroMetricBody}
                size="lg"
                label="Критический порог"
                value={thresholdLabel}
                caption="Ниже — проблемная зона"
              />
          </div>
        </div>
      </header>

      <DistrictExplorer
        scenario={scenario}
        selectedDistrictId={selectedDistrictId}
        onSelectDistrict={onSelectDistrict}
      />

      <footer className={styles.cta}>
        <p className={styles.ctaText}>
          {selectedDistrict
            ? `Район «${selectedDistrict.name}» можно будет назначить мерам на следующем шаге.`
            : "Район для мер выбирается на следующем шаге, в карточке каждой меры."}
        </p>
        <Button size="lg" onClick={onStartPlanning}>
          Перейти к решениям
        </Button>
      </footer>
    </section>
  );
}
