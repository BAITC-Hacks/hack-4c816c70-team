"use client";

import Link from "next/link";
import { useId } from "react";
import type { DistrictId, ScenarioVM } from "@/lib/contracts/ui";
import { Badge, Button, Reveal, Skeleton } from "@/components/ui";
import { CityScene } from "./CityScene";
import { DistrictExplorer } from "./DistrictExplorer";
import { useCityCopy } from "./use-city-copy";
import styles from "./home.module.css";

export type ScenarioLoadStatus = "loading" | "ready" | "error";

export interface CityHomeProps {
  /** Сценарий из API; null, пока не загружен или при ошибке. */
  readonly scenario: ScenarioVM | null;
  readonly scenarioStatus: ScenarioLoadStatus;
  readonly scenarioError?: string | null;
  readonly onRetry: () => void;
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
  /** Адрес рабочего экрана, обычно "/decisions". */
  readonly decisionsHref: string;
}

/**
 * Главная: первый экран, «Как это работает», районы и заключительный CTA.
 * Вводный текст не зависит от API; числа сценария приходят только через props.
 */
export function CityHome({
  scenario,
  scenarioStatus,
  scenarioError,
  onRetry,
  selectedDistrictId,
  onSelectDistrict,
  decisionsHref,
}: CityHomeProps) {
  const uid = useId();
  const heroId = `${uid}-hero`;
  const howId = `${uid}-how`;
  const districtsId = `${uid}-districts`;
  const finalId = `${uid}-final`;
  const ready = scenarioStatus === "ready" && scenario !== null;
  const rules = scenario?.rules ?? null;
  const { copy, amount, score, district: districtLabel } = useCityCopy();
  const selectedDistrict = scenario?.districts.find((district) => district.id === selectedDistrictId);
  const selectedName = selectedDistrict ? districtLabel(selectedDistrict) : null;

  const steps = [
    { title: copy.step1Title, text: copy.step1Text(scenario ? amount(scenario.criticalThreshold) : null) },
    {
      title: copy.step2Title,
      text: copy.step2Text(rules?.requiredChoices ?? null, rules?.maxPerCategory ?? null),
    },
    { title: copy.step3Title, text: copy.step3Text },
  ];

  return (
    <div className={styles.home}>
      {/* ===== Первый экран ===== */}
      <section className={styles.hero} aria-labelledby={heroId}>
        <Reveal className={styles.heroText} index={0}>
          <h1 id={heroId} className={styles.heroTitle}>
            {copy.heroLine1}
            <br />
            {copy.heroLine2}
          </h1>
          <p className={styles.heroLead}>{copy.heroLead}</p>
          <div className={styles.heroActions}>
            <Button size="lg" asChild>
              <Link href={decisionsHref}>{copy.ctaDecide}</Link>
            </Button>
            <a href={`#${howId}`} className={styles.textLink}>
              {copy.howLink}
            </a>
          </div>
        </Reveal>

        <div className={styles.heroArt}>
          <CityScene
            districtIds={scenario?.districts.map((district) => district.id) ?? []}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
          />
        </div>

        <Reveal className={styles.facts} index={1}>
          {ready ? (
            <>
              <dl className={styles.factList}>
                <div className={styles.fact}>
                  <dt>{copy.factScore}</dt>
                  <dd className={styles.factValueLarge}>{score(scenario.baselineScore)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>{copy.factBudget}</dt>
                  <dd>
                    {amount(scenario.budget)} <span className={styles.factUnit}>{copy.factBudgetUnit}</span>
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>{copy.factHorizon}</dt>
                  <dd>
                    {amount(scenario.horizonQuarters)}{" "}
                    <span className={styles.factUnit}>{copy.quarters(scenario.horizonQuarters)}</span>
                  </dd>
                </div>
              </dl>
              {scenario.source === "fixture" ? (
                <Badge tone="warning">{copy.fixtureBadge}</Badge>
              ) : null}
            </>
          ) : scenarioStatus === "error" ? (
            <div className={styles.factsError} role="alert">
              <p>
                <strong>{copy.errorTitle}</strong> {scenarioError ?? copy.errorFallback}
              </p>
              <Button variant="secondary" onClick={onRetry}>
                {copy.retry}
              </Button>
            </div>
          ) : (
            <div className={styles.factList} aria-busy="true">
              <p className="visually-hidden" aria-live="polite">
                {copy.loading}
              </p>
              {[0, 1, 2].map((key) => (
                <div key={key} className={styles.fact}>
                  <Skeleton width="6em" />
                  <Skeleton width="4em" height="2.25rem" />
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ===== Как это работает ===== */}
      <section id={howId} className={styles.section} aria-labelledby={`${howId}-title`}>
        <Reveal className={styles.sectionHead}>
          <h2 id={`${howId}-title`} className={styles.sectionTitle}>
            {copy.howTitle}
          </h2>
        </Reveal>
        <ol className={styles.steps} role="list">
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} index={index} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ===== Районы ===== */}
      <section className={styles.section} aria-labelledby={districtsId}>
        <Reveal className={styles.sectionHead}>
          <h2 id={districtsId} className={styles.sectionTitle}>
            {copy.districtsTitle}
          </h2>
          <p className={styles.sectionLead}>{copy.districtsLead}</p>
        </Reveal>
        {ready ? (
          <Reveal>
            <DistrictExplorer
              scenario={scenario}
              selectedDistrictId={selectedDistrictId}
              onSelectDistrict={onSelectDistrict}
              headingLevel={3}
            />
          </Reveal>
        ) : scenarioStatus === "error" ? (
          <div className={styles.placeholder}>
            <p>{copy.districtsPlaceholder}</p>
            <Button variant="secondary" onClick={onRetry}>
              {copy.retry}
            </Button>
          </div>
        ) : (
          <div className={styles.placeholderGrid} aria-hidden="true">
            <Skeleton shape="block" height="min(56vw, 420px)" />
            <Skeleton shape="block" height="min(56vw, 420px)" />
          </div>
        )}
      </section>

      {/* ===== Заключительный призыв ===== */}
      <section className={styles.final} aria-labelledby={finalId}>
        <Reveal className={styles.finalInner}>
          <h2 id={finalId} className={styles.finalTitle}>
            {copy.finalTitle}
          </h2>
          <p className={styles.finalText}>{copy.finalText(selectedName)}</p>
          <Button size="lg" asChild>
            <Link href={decisionsHref}>{copy.ctaDecide}</Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
}
