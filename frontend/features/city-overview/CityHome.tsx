"use client";

import Link from "next/link";
import { useId } from "react";
import type { DistrictId, ScenarioVM } from "@/lib/contracts/ui";
import { Badge, Button, Reveal, Skeleton } from "@/components/ui";
import { CityScene } from "./CityScene";
import { DistrictExplorer } from "./DistrictExplorer";
import { formatAmount, formatScore, plural } from "./format";
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
  const selectedName = scenario?.districts.find((district) => district.id === selectedDistrictId)?.name;

  const steps = [
    {
      title: "Изучите районы",
      text: scenario
        ? `Посмотрите исходные показатели и найдите значения ниже критического порога ${formatAmount(scenario.criticalThreshold)}.`
        : "Посмотрите исходные показатели и найдите значения ниже критического порога.",
    },
    {
      title: "Соберите план",
      text: rules
        ? `Ровно ${rules.requiredChoices} ${plural(rules.requiredChoices, ["мера", "меры", "мер"])} в пределах бюджета, не больше ${rules.maxPerCategory} по одному направлению. Конфликтующие пары видны сразу.`
        : "Выберите меры в пределах бюджета и назначьте районы. Конфликтующие пары видны сразу.",
    },
    {
      title: "Получите оценку",
      text: "Сервер проверит набор, рассчитает Score и изменения по районам и объяснит результат.",
    },
  ];

  return (
    <div className={styles.home}>
      {/* ===== Первый экран ===== */}
      <section className={styles.hero} aria-labelledby={heroId}>
        <Reveal className={styles.heroText} index={0}>
          <h1 id={heroId} className={styles.heroTitle}>
            Пять решений.
            <br />
            Один город.
          </h1>
          <p className={styles.heroLead}>
            Вы — аким на пять часов. Выберите меры для районов в пределах бюджета: сервер
            рассчитает, как изменится качество жизни, и объяснит, почему.
          </p>
          <div className={styles.heroActions}>
            <Button size="lg" asChild>
              <Link href={decisionsHref}>Принять решения</Link>
            </Button>
            <a href={`#${howId}`} className={styles.textLink}>
              Как это работает
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
                  <dt>Исходный Score</dt>
                  <dd className={styles.factValueLarge}>{formatScore(scenario.baselineScore)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Бюджет</dt>
                  <dd>
                    {formatAmount(scenario.budget)} <span className={styles.factUnit}>ед.</span>
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>Горизонт</dt>
                  <dd>
                    {formatAmount(scenario.horizonQuarters)}{" "}
                    <span className={styles.factUnit}>
                      {plural(scenario.horizonQuarters, ["квартал", "квартала", "кварталов"])}
                    </span>
                  </dd>
                </div>
              </dl>
              {scenario.source === "fixture" ? (
                <Badge tone="warning">Демонстрационные данные, не ответ API</Badge>
              ) : null}
            </>
          ) : scenarioStatus === "error" ? (
            <div className={styles.factsError} role="alert">
              <p>
                <strong>Данные сценария недоступны.</strong>{" "}
                {scenarioError ?? "Не удалось получить бюджет, Score и районы."}
              </p>
              <Button variant="secondary" onClick={onRetry}>
                Повторить загрузку
              </Button>
            </div>
          ) : (
            <div className={styles.factList} aria-busy="true">
              <p className="visually-hidden" aria-live="polite">
                Загружаем данные сценария…
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
            Как это работает
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
            Районы до решений
          </h2>
          <p className={styles.sectionLead}>
            Исходные показатели на шкале 0–100. Выбранный район будет предложен для районных мер —
            назначение можно изменить в каждой карточке.
          </p>
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
            <p>Схема и показатели районов появятся после загрузки сценария.</p>
            <Button variant="secondary" onClick={onRetry}>
              Повторить загрузку
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
            Готовы принять решения?
          </h2>
          <p className={styles.finalText}>
            {selectedName
              ? `Район «${selectedName}» уже предложен для районных мер.`
              : "Район для каждой меры выбирается прямо в её карточке."}{" "}
            Черновик плана сохранится, пока вы переходите между страницами.
          </p>
          <Button size="lg" asChild>
            <Link href={decisionsHref}>Принять решения</Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
}
