"use client";

import { useId, useMemo } from "react";
import type { CityOverviewProps } from "@/lib/contracts/ui";
import { Badge, Button, Metric, Panel, cx } from "@/components/ui";
import { DistrictAtlas } from "./DistrictAtlas";
import { DistrictDetails } from "./DistrictDetails";
import { summarizeDistrict } from "./district-summary";
import { formatAmount, formatScore, formatShare, plural } from "./format";
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
  const detailsHeadingId = `${uid}-details`;
  const listHeadingId = `${uid}-list`;

  const { budget, horizonQuarters, criticalThreshold, baselineScore, indicators, districts } =
    scenario;

  const summaries = useMemo(
    () => districts.map((district) => summarizeDistrict(district, indicators, criticalThreshold)),
    [districts, indicators, criticalThreshold],
  );

  const selectedSummary =
    summaries.find((summary) => summary.district.id === selectedDistrictId) ?? null;
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
                size="display"
                label="Базовый Score"
                value={formatScore(baselineScore)}
                caption="Оценка города до решений"
              />
          </div>
          <div className={styles.heroMetric}>
              <Metric size="lg" label="Бюджет" value={formatAmount(budget)} unit="ед." />
          </div>
          <div className={styles.heroMetric}>
              <Metric
                size="lg"
                label="Горизонт"
                value={formatAmount(horizonQuarters)}
                unit={plural(horizonQuarters, ["квартал", "квартала", "кварталов"])}
              />
          </div>
          <div className={styles.heroMetric}>
              <Metric
                size="lg"
                label="Критический порог"
                value={thresholdLabel}
                caption="Ниже — проблемная зона"
              />
          </div>
        </div>
      </header>

      <div className={styles.stage}>
        <Panel as="div" padding="md" className={styles.atlasPanel}>
          <DistrictAtlas
            summaries={summaries}
            criticalThreshold={criticalThreshold}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
          />
        </Panel>
        <Panel
          as="section"
          aria-labelledby={detailsHeadingId}
          className={styles.detailsPanel}
        >
          <DistrictDetails
            summary={selectedSummary}
            indicatorCount={indicators.length}
            criticalThreshold={criticalThreshold}
            headingId={detailsHeadingId}
          />
        </Panel>
      </div>

      <section aria-labelledby={listHeadingId} className={styles.listSection}>
        <h2 id={listHeadingId} className={styles.sectionTitle}>
          Районы
        </h2>
        <ul className={styles.cards} role="list">
          {summaries.map(({ district, readings, critical, weakest }) => {
            const isSelected = district.id === selectedDistrictId;
            const criticalCount = critical.length;
            return (
              <li key={district.id} className={styles.cardItem}>
                <button
                  type="button"
                  className={cx(styles.card, isSelected && styles.cardSelected)}
                  aria-pressed={isSelected}
                  onClick={() => onSelectDistrict(district.id)}
                >
                  <span className={styles.cardHead}>
                    <span className={styles.cardName}>{district.name}</span>
                    {isSelected ? (
                      <span className={styles.cardSelectedMark}>
                        <span aria-hidden="true">●</span> Выбран
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.cardShare}>
                    <span className={styles.cardShareValue}>
                      {formatShare(district.populationShare)}
                    </span>{" "}
                    жителей города
                  </span>
                  <span className={styles.cardStrip} aria-hidden="true">
                    {readings.map((reading) => (
                      <span
                        key={reading.indicator.id}
                        className={cx(styles.stripBar, reading.isCritical && styles.stripBarCritical)}
                        style={{ height: `${Math.min(100, Math.max(4, reading.value))}%` }}
                      />
                    ))}
                    <span
                      className={styles.stripThreshold}
                      style={{ bottom: `${Math.min(100, Math.max(0, criticalThreshold))}%` }}
                    />
                  </span>
                  {criticalCount > 0 ? (
                    <Badge tone="danger">
                      <span aria-hidden="true">▼</span> {criticalCount}{" "}
                      {plural(criticalCount, ["показатель", "показателя", "показателей"])} ниже{" "}
                      {thresholdLabel}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Нет значений ниже {thresholdLabel}</Badge>
                  )}
                  {weakest ? (
                    <span className={styles.cardWeakest}>
                      Самый низкий: {weakest.indicator.name},{" "}
                      <span className="tabular">{formatScore(weakest.value)}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="visually-hidden" aria-live="polite">
        {selectedSummary
          ? `Выбран район ${selectedSummary.district.name}: ${
              selectedSummary.critical.length > 0
                ? `${selectedSummary.critical.length} ${plural(selectedSummary.critical.length, ["показатель", "показателя", "показателей"])} ниже ${thresholdLabel}`
                : `нет показателей ниже ${thresholdLabel}`
            }.`
          : ""}
      </p>

      <footer className={styles.cta}>
        <p className={styles.ctaText}>
          {selectedSummary
            ? `Район «${selectedSummary.district.name}» можно будет назначить мерам на следующем шаге.`
            : "Район для мер выбирается на следующем шаге, в карточке каждой меры."}
        </p>
        <Button size="lg" onClick={onStartPlanning}>
          Перейти к решениям
        </Button>
      </footer>
    </section>
  );
}
