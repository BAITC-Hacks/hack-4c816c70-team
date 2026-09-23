"use client";

import { useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  CategoryId,
  ChoiceDraft,
  DistrictId,
  IndicatorId,
  MeasureId,
  MeasureVM,
  PlannerProps,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { DecisionTray } from "./DecisionTray";
import { CATEGORY_LABELS, CATEGORY_ORDER, formatUnits } from "./labels";
import { MeasureCard } from "./MeasureCard";
import {
  addChoice,
  getAddAvailability,
  getDistrictConflicts,
  getDistrictOptions,
  getPotentialSynergies,
  indexMeasures,
  removeChoice,
  setChoiceDistrict,
  validateDraft,
} from "./selection-rules";
import styles from "./planner.module.css";

type CategoryFilter = CategoryId | "all";

/**
 * Конструктор пяти решений. choices принадлежат родителю: любое изменение
 * возвращается новым массивом через onChoicesChange. Локально хранятся только
 * фильтр, район-кандидат для ещё не добавленных карточек и раскрытие панели.
 */
export function Planner({
  scenario,
  choices,
  preferredDistrictId,
  isEvaluating,
  serverError,
  onChoicesChange,
  onEvaluate,
  onBack,
}: PlannerProps) {
  const trayId = useId();
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [pendingDistricts, setPendingDistricts] = useState<Readonly<Record<MeasureId, DistrictId | "">>>({});
  const [isTrayOpen, setTrayOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const trayHeadingRef = useRef<HTMLHeadingElement>(null);
  const trayToggleRef = useRef<HTMLButtonElement>(null);

  const measureById = useMemo(() => indexMeasures(scenario), [scenario]);
  const indicatorNames = useMemo(
    () => new Map<IndicatorId, string>(scenario.indicators.map((indicator) => [indicator.id, indicator.name])),
    [scenario.indicators],
  );
  const validation = useMemo(() => validateDraft(scenario, choices), [scenario, choices]);
  const potentialSynergies = useMemo(() => getPotentialSynergies(scenario, choices), [scenario, choices]);

  const rules = scenario.rules;
  const requiredChoices = rules?.requiredChoices ?? null;
  const preferredDistrict = scenario.districts.find((district) => district.id === preferredDistrictId);
  const visibleMeasures =
    filter === "all" ? scenario.measures : scenario.measures.filter((measure) => measure.category === filter);
  const choiceById = new Map(choices.map((choice) => [choice.measureId, choice]));
  const selectedPerCategory = new Map<CategoryId, number>();
  for (const choice of choices) {
    const category = measureById.get(choice.measureId)?.category;
    if (category) selectedPerCategory.set(category, (selectedPerCategory.get(category) ?? 0) + 1);
  }

  const canEdit = !isEvaluating;
  const districtOptionsFor = (measureId: MeasureId) => getDistrictOptions(scenario, choices, measureId);

  /** Район по умолчанию для новой карточки: выбранный в атласе, если он не конфликтует. */
  function pendingDistrictFor(measure: MeasureVM): DistrictId | "" {
    const local = pendingDistricts[measure.id];
    if (local !== undefined) return local;
    if (!preferredDistrict) return "";
    return getDistrictConflicts(scenario, choices, measure.id, preferredDistrict.id).length === 0
      ? preferredDistrict.id
      : "";
  }

  function commit(next: readonly ChoiceDraft[]) {
    if (canEdit && next !== choices) onChoicesChange(next);
  }

  function handleAdd(measure: MeasureVM) {
    const districtId = pendingDistrictFor(measure);
    if (getAddAvailability(scenario, choices, measure.id, districtId).status !== "available") return;
    commit(addChoice(choices, measure, districtId));
    setPendingDistricts((current) => {
      const next = { ...current };
      delete next[measure.id];
      return next;
    });
  }

  function handleEvaluate() {
    if (isEvaluating) return;
    if (!validation.canSubmit) {
      flushSync(() => setTrayOpen(true));
      summaryRef.current?.focus();
      return;
    }
    onEvaluate();
  }

  function openTray() {
    flushSync(() => setTrayOpen(true));
    trayHeadingRef.current?.focus();
  }

  function closeTray() {
    setTrayOpen(false);
    trayToggleRef.current?.focus();
  }

  return (
    <section
      className={styles.planner}
      aria-labelledby={`${trayId}-title`}
      data-tray-open={isTrayOpen}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isTrayOpen) closeTray();
      }}
    >
      <header className={styles.plannerHeader}>
        <div>
          <h2 id={`${trayId}-title`} className={styles.plannerTitle}>
            {requiredChoices !== null ? `Выберите ${requiredChoices} решений` : "Каталог решений"}
          </h2>
          <p className={styles.textMuted}>
            Бюджет {formatUnits(scenario.budget)} ед., горизонт {formatUnits(scenario.horizonQuarters)} кв.
            {rules ? ` Не больше ${rules.maxPerCategory} мер одного направления.` : null}
          </p>
        </div>
        <Button variant="secondary" onClick={onBack} disabled={isEvaluating}>
          <span aria-hidden="true">←</span>К обзору города
        </Button>
      </header>

      {rules === null ? (
        <p className={styles.rulesMissing} role="status">
          <span aria-hidden="true">! </span>
          Правила выбора ещё не получены от сервера. Каталог можно просмотреть, но добавление мер и оценка
          недоступны.
        </p>
      ) : null}

      <p className={styles.srOnly} aria-live="polite">
        {isEvaluating
          ? "Оцениваем решения, изменения временно заблокированы."
          : `Выбрано ${choices.length} из ${requiredChoices ?? "—"}. Предварительный остаток ${formatUnits(validation.provisionalRemaining)} ед.`}
      </p>

      <fieldset className={styles.lock} disabled={isEvaluating}>
        <legend className={styles.srOnly}>Конструктор решений</legend>
        <div className={styles.layout}>
          <div className={styles.catalog}>
            <div className={styles.filters} role="group" aria-label="Направления">
              <button
                type="button"
                className={styles.chip}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Все направления
              </button>
              {CATEGORY_ORDER.map((category) => {
                const selected = selectedPerCategory.get(category) ?? 0;
                return (
                  <button
                    key={category}
                    type="button"
                    className={styles.chip}
                    aria-pressed={filter === category}
                    onClick={() => setFilter(category)}
                  >
                    {CATEGORY_LABELS[category]}
                    {rules ? (
                      <span className={styles.chipCount}>
                        {" "}
                        {selected}/{rules.maxPerCategory}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {preferredDistrict ? (
              <p className={styles.textMuted}>
                Район из обзора — {preferredDistrict.name} — предложен для новых мер. Назначение можно изменить в
                каждой карточке.
              </p>
            ) : null}

            {visibleMeasures.length > 0 ? (
              <ul className={styles.cards}>
                {visibleMeasures.map((measure) => (
                  <li key={measure.id}>
                    <MeasureCard
                      measure={measure}
                      indicatorNames={indicatorNames}
                      choice={choiceById.get(measure.id)}
                      availability={getAddAvailability(scenario, choices, measure.id, pendingDistrictFor(measure))}
                      districtOptions={districtOptionsFor(measure.id)}
                      pendingDistrictId={pendingDistrictFor(measure)}
                      onPendingDistrictChange={(districtId) =>
                        setPendingDistricts((current) => ({ ...current, [measure.id]: districtId }))
                      }
                      onAdd={() => handleAdd(measure)}
                      onRemove={() => commit(removeChoice(choices, measure.id))}
                      onDistrictChange={(districtId) => commit(setChoiceDistrict(choices, measure, districtId))}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>В этом направлении нет мер в каталоге.</p>
            )}
          </div>

          <DecisionTray
            id={trayId}
            budget={scenario.budget}
            requiredChoices={requiredChoices}
            choices={choices}
            measureById={measureById}
            districtOptionsFor={districtOptionsFor}
            validation={validation}
            potentialSynergies={potentialSynergies}
            isEvaluating={isEvaluating}
            serverError={serverError}
            summaryRef={summaryRef}
            headingRef={trayHeadingRef}
            onRemove={(measureId) => commit(removeChoice(choices, measureId))}
            onDistrictChange={(measure, districtId) => commit(setChoiceDistrict(choices, measure, districtId))}
            onEvaluate={handleEvaluate}
            onClose={closeTray}
          />
        </div>

        <div className={styles.mobileBar}>
          <button
            ref={trayToggleRef}
            type="button"
            className={styles.mobileSummary}
            aria-expanded={isTrayOpen}
            aria-controls={trayId}
            onClick={() => (isTrayOpen ? closeTray() : openTray())}
          >
            <strong>
              {choices.length} из {requiredChoices ?? "—"}
            </strong>
            <span>
              {validation.provisionalRemaining < 0
                ? `✕ превышение ${formatUnits(-validation.provisionalRemaining)} ед.`
                : `остаток ${formatUnits(validation.provisionalRemaining)} ед.`}
            </span>
            <span className={styles.mobileToggle}>{isTrayOpen ? "Свернуть" : "Решения"}</span>
          </button>
          <Button
            className={styles.evaluateCompact}
            busy={isEvaluating}
            aria-disabled={!validation.canSubmit || isEvaluating}
            aria-describedby={`${trayId}-summary`}
            onClick={handleEvaluate}
          >
            {isEvaluating ? "Оцениваем…" : "Оценить"}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
