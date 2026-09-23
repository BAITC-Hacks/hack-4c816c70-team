"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  CategoryId,
  ChoiceDraft,
  DistrictId,
  MeasureId,
  MeasureVM,
  PlannerProps,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { useLocale } from "@/lib/i18n";
import { BudgetRibbon, type RibbonSegment } from "./BudgetRibbon";
import { DecisionTray } from "./DecisionTray";
import { CATEGORY_ORDER } from "./labels";
import { createPlannerText } from "./localize";
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

/** Район для новой карточки: выбранный вручную, иначе район из обзора, если он без конфликта. */
function resolvePendingDistrict(
  scenario: PlannerProps["scenario"],
  choices: readonly ChoiceDraft[],
  pendingDistricts: Readonly<Record<MeasureId, DistrictId | "">>,
  preferredDistrictId: DistrictId | undefined,
  measure: MeasureVM,
): DistrictId | "" {
  const local = pendingDistricts[measure.id];
  if (local !== undefined) return local;
  if (preferredDistrictId === undefined || measure.scope === "city") return "";
  return getDistrictConflicts(scenario, choices, measure.id, preferredDistrictId).length === 0
    ? preferredDistrictId
    : "";
}

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
  const { locale } = useLocale();
  // Смена языка меняет только тексты: choices, доступность и расходы от неё не зависят.
  const t = useMemo(() => createPlannerText(locale, scenario), [locale, scenario]);
  const copy = t.copy;
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [pendingDistricts, setPendingDistricts] = useState<Readonly<Record<MeasureId, DistrictId | "">>>({});
  const [isTrayOpen, setTrayOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const trayHeadingRef = useRef<HTMLHeadingElement>(null);
  const trayToggleRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);

  // Нижняя панель может вырасти (крупный текст, перенос строки). Лист плана и отступ
  // страницы опираются на её фактическую высоту, а не на константу, иначе CTA уходит под панель.
  function syncMobileBarHeight() {
    const height = mobileBarRef.current?.getBoundingClientRect().height ?? 0;
    if (height > 0) sectionRef.current?.style.setProperty("--mobile-bar-actual", `${Math.ceil(height)}px`);
  }

  useEffect(() => {
    const bar = mobileBarRef.current;
    const section = sectionRef.current;
    if (!bar || !section) return;
    const sync = () => {
      const height = bar.getBoundingClientRect().height;
      if (height > 0) section.style.setProperty("--mobile-bar-actual", `${Math.ceil(height)}px`);
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const rules = scenario.rules;
  const requiredChoices = rules?.requiredChoices ?? null;
  const preferredDistrict = scenario.districts.find((district) => district.id === preferredDistrictId);

  const measureById = useMemo(() => indexMeasures(scenario), [scenario]);
  const validation = useMemo(() => validateDraft(scenario, choices), [scenario, choices]);
  const potentialSynergies = useMemo(() => getPotentialSynergies(scenario, choices), [scenario, choices]);
  const segments = useMemo<RibbonSegment[]>(
    () =>
      choices.flatMap((choice) => {
        const measure = measureById.get(choice.measureId);
        return measure ? [{ measureId: measure.id, cost: measure.cost }] : [];
      }),
    [choices, measureById],
  );
  const synergyPartners = useMemo(() => {
    const partners = new Map<MeasureId, MeasureId[]>();
    for (const { measureIds: [a, b] } of rules?.synergies ?? []) {
      partners.set(a, [...(partners.get(a) ?? []), b]);
      partners.set(b, [...(partners.get(b) ?? []), a]);
    }
    return partners;
  }, [rules]);
  const selectedPerCategory = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const choice of choices) {
      const category = measureById.get(choice.measureId)?.category;
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [choices, measureById]);

  const preferredId = preferredDistrict?.id;
  // Всё, что карточке нужно для отрисовки, считается один раз на изменение набора.
  const cards = scenario.measures.map((measure) => {
        const pendingDistrictId = resolvePendingDistrict(scenario, choices, pendingDistricts, preferredId, measure);
        const availability = getAddAvailability(scenario, choices, measure.id, pendingDistrictId);
        const blockedBeyondDistrict =
          availability.status === "blocked" &&
          getAddAvailability(scenario, choices, measure.id).status === "blocked";
        return {
          measure,
          pendingDistrictId,
          availability,
          choice: choices.find((choice) => choice.measureId === measure.id),
          showDistrictChoice: !blockedBeyondDistrict,
          districtOptions: getDistrictOptions(scenario, choices, measure.id),
        };
      });
  const visibleCards = filter === "all" ? cards : cards.filter((card) => card.measure.category === filter);

  function commit(next: readonly ChoiceDraft[]) {
    if (!isEvaluating && next !== choices) onChoicesChange(next);
  }

  function handleAdd(measure: MeasureVM) {
    const districtId = resolvePendingDistrict(scenario, choices, pendingDistricts, preferredId, measure);
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
      syncMobileBarHeight();
      summaryRef.current?.focus();
      return;
    }
    onEvaluate();
  }

  function openTray() {
    flushSync(() => setTrayOpen(true));
    syncMobileBarHeight();
    trayHeadingRef.current?.focus();
  }

  function closeTray() {
    setTrayOpen(false);
    trayToggleRef.current?.focus();
  }

  const isOverBudget = validation.provisionalRemaining < 0;

  return (
    <section
      ref={sectionRef}
      className={styles.planner}
      aria-labelledby={`${trayId}-title`}
      data-tray-open={isTrayOpen}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isTrayOpen) closeTray();
      }}
    >
      <header className={styles.plannerHeader}>
        <div className={styles.intro}>
          <h1 id={`${trayId}-title`} className={styles.plannerTitle}>
            {requiredChoices !== null ? copy.title(requiredChoices) : copy.titleWithoutRules}
          </h1>
          <p className={styles.lede}>
            {copy.lede(t.units(scenario.budget), t.units(scenario.horizonQuarters))}
            {rules ? ` ${copy.ledeLimit(rules.maxPerCategory)}` : null}
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} disabled={isEvaluating}>
          {copy.back}
        </Button>
      </header>

      {rules === null ? (
        <p className={styles.rulesMissing} role="status">
          <span aria-hidden="true">! </span>
          {copy.rulesMissing}
        </p>
      ) : null}

      <p className={styles.srOnly} aria-live="polite">
        {isEvaluating
          ? copy.liveEvaluating
          : copy.liveStatus(choices.length, requiredChoices, t.units(validation.provisionalRemaining))}
      </p>

      <fieldset className={styles.lock} disabled={isEvaluating}>
        <legend className={styles.srOnly}>{copy.builderLegend}</legend>
        <div className={styles.layout}>
          <div className={styles.catalog}>
            <div className={styles.filters} role="group" aria-label={copy.filtersLabel}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                {copy.filterAll}
              </button>
              {CATEGORY_ORDER.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filter === category}
                  onClick={() => setFilter(category)}
                >
                  {t.category(category)}
                  {rules ? (
                    <span className={styles.chipCount}>
                      {selectedPerCategory.get(category) ?? 0}/{rules.maxPerCategory}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {preferredDistrict ? (
              <p className={styles.textMuted}>
                {copy.preferredDistrict(t.district(preferredDistrict.id))}
              </p>
            ) : null}

            {visibleCards.length > 0 ? (
              <ul className={styles.cards}>
                {visibleCards.map((card) => (
                  <li key={card.measure.id}>
                    <MeasureCard
                      measure={card.measure}
                      budget={scenario.budget}
                      t={t}
                      choice={card.choice}
                      availability={card.availability}
                      showDistrictChoice={card.showDistrictChoice}
                      districtOptions={card.districtOptions}
                      pendingDistrictId={card.pendingDistrictId}
                      synergyPartners={synergyPartners.get(card.measure.id) ?? []}
                      onPendingDistrictChange={(districtId) =>
                        setPendingDistricts((current) => ({ ...current, [card.measure.id]: districtId }))
                      }
                      onAdd={() => handleAdd(card.measure)}
                      onRemove={() => commit(removeChoice(choices, card.measure.id))}
                      onDistrictChange={(districtId) => commit(setChoiceDistrict(choices, card.measure, districtId))}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{copy.emptyCategory}</p>
            )}
          </div>

          <div className={styles.trayColumn}>
            <div className={styles.scrim} aria-hidden="true" onClick={closeTray} />
            <DecisionTray
              id={trayId}
              t={t}
              scenario={scenario}
              budget={scenario.budget}
              requiredChoices={requiredChoices}
              choices={choices}
              measureById={measureById}
              segments={segments}
              districtOptionsFor={(measureId) => getDistrictOptions(scenario, choices, measureId)}
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
        </div>

        <div ref={mobileBarRef} className={styles.mobileBar}>
          <button
            ref={trayToggleRef}
            type="button"
            className={styles.mobileSummary}
            aria-expanded={isTrayOpen}
            aria-controls={trayId}
            onClick={() => (isTrayOpen ? closeTray() : openTray())}
          >
            <span className={styles.mobileLine}>
              <strong>
                {choices.length} {copy.ofTotal(requiredChoices)}
              </strong>
              <span data-over={isOverBudget}>
                {isOverBudget
                  ? `✕ ${copy.mobileOver(t.units(-validation.provisionalRemaining))}`
                  : copy.mobileRemaining(t.units(validation.provisionalRemaining))}
              </span>
              {/* Подпись постоянная: смена на «Свернуть» переносила строку и увеличивала панель. */}
              <span className={styles.mobileToggle}>
                {copy.plan}
                <span className={styles.chevron} aria-hidden="true" />
              </span>
            </span>
            <BudgetRibbon t={t} budget={scenario.budget} segments={segments} className={styles.ribbonThin} />
          </button>
          <Button
            className={styles.evaluateCompact}
            busy={isEvaluating}
            aria-disabled={!validation.canSubmit || isEvaluating}
            aria-describedby={`${trayId}-summary`}
            onClick={handleEvaluate}
          >
            {isEvaluating ? copy.evaluatingShort : copy.evaluateShort}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
