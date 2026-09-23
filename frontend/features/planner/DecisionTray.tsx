import type { Ref } from "react";
import type {
  ChoiceDraft,
  DistrictId,
  DraftValidation,
  MeasureId,
  MeasureVM,
  ScenarioVM,
  SelectionIssue,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { BudgetRibbon, type RibbonSegment } from "./BudgetRibbon";
import { DistrictPicker } from "./DistrictPicker";
import { describeIssue, type PlannerText } from "./localize";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DecisionTrayProps {
  readonly id: string;
  readonly t: PlannerText;
  readonly scenario: ScenarioVM;
  readonly budget: number;
  readonly requiredChoices: number | null;
  readonly choices: readonly ChoiceDraft[];
  readonly measureById: ReadonlyMap<MeasureId, MeasureVM>;
  readonly segments: readonly RibbonSegment[];
  readonly districtOptionsFor: (measureId: MeasureId) => readonly DistrictOption[];
  readonly validation: DraftValidation;
  readonly potentialSynergies: readonly (readonly [MeasureId, MeasureId])[];
  readonly isEvaluating: boolean;
  readonly summaryRef: Ref<HTMLDivElement>;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onRemove: (measureId: MeasureId) => void;
  readonly onDistrictChange: (measure: MeasureVM, districtId: DistrictId | "") => void;
  readonly onEvaluate: () => void;
  readonly onClose: () => void;
}

/** Пока выбор не закончен, счётчик мер — прогресс, а не ошибка. */
function isProgressIssue(issue: SelectionIssue): boolean {
  return issue.code === "choice-count";
}

export function DecisionTray({
  id,
  t,
  scenario,
  budget,
  requiredChoices,
  choices,
  measureById,
  segments,
  districtOptionsFor,
  validation,
  potentialSynergies,
  isEvaluating,
  summaryRef,
  headingRef,
  onRemove,
  onDistrictChange,
  onEvaluate,
  onClose,
}: DecisionTrayProps) {
  const copy = t.copy;
  const emptySlots = Math.max(0, (requiredChoices ?? 0) - choices.length);
  const isOverBudget = validation.provisionalRemaining < 0;
  const blockingIssues = validation.issues.filter((issue) => !isProgressIssue(issue));
  const progressIssue = validation.issues.find(isProgressIssue);
  const describe = (issue: SelectionIssue) => describeIssue(issue, scenario, choices, validation, t);

  return (
    <aside id={id} className={styles.tray} aria-labelledby={`${id}-heading`}>
      <div className={styles.trayHeader}>
        <h2 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className={styles.trayTitle}>
          {copy.plan}
        </h2>
        <p className={styles.counter}>
          <strong>{choices.length}</strong> {copy.ofTotal(requiredChoices)}
        </p>
        <Button variant="secondary" className={styles.trayClose} onClick={onClose}>
          {copy.collapse}
        </Button>
      </div>

      <section className={styles.budget} aria-label={copy.budgetLabel}>
        <BudgetRibbon t={t} budget={budget} segments={segments} />
        <dl className={styles.budgetFigures}>
          <div>
            <dt>{copy.spent}</dt>
            <dd>
              <span key={validation.provisionalSpent} className={styles.flash}>
                {t.units(validation.provisionalSpent)}
              </span>{" "}
              {copy.ofBudget(t.units(budget))}
            </dd>
          </div>
          <div data-over={isOverBudget}>
            <dt>{isOverBudget ? copy.overBudget : copy.remaining}</dt>
            <dd>
              {isOverBudget ? <span aria-hidden="true">✕ </span> : null}
              <span key={validation.provisionalRemaining} className={styles.flash}>
                {t.units(Math.abs(validation.provisionalRemaining))}
              </span>{" "}
              {copy.unit}
            </dd>
          </div>
        </dl>
        <p className={styles.textMuted}>{copy.estimateNote}</p>
      </section>

      <ol className={styles.slots}>
        {choices.map((choice, index) => {
          const measure = measureById.get(choice.measureId);
          const hasIssue = validation.issues.some(
            (issue) => !isProgressIssue(issue) && issue.measureIds?.includes(choice.measureId),
          );
          return (
            <li key={`${choice.measureId}-${index}`} className={styles.slot} data-state={hasIssue ? "issue" : "ok"}>
              <div className={styles.slotHead}>
                <span className={styles.measureId}>{choice.measureId}</span>
                <p className={styles.slotName}>
                  {measure ? t.measure(measure.id) : copy.measureNotFound(choice.measureId)}
                </p>
                <span className={styles.slotCost}>{measure ? t.units(measure.cost) : "—"}</span>
                <button
                  type="button"
                  className={styles.slotRemove}
                  aria-label={copy.removeFromPlan(choice.measureId)}
                  onClick={() => onRemove(choice.measureId)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {measure?.scope === "district" ? (
                <DistrictPicker
                  t={t}
                  label={copy.districtShort}
                  options={districtOptionsFor(measure.id)}
                  value={choice.districtId ?? ""}
                  onChange={(districtId) => onDistrictChange(measure, districtId)}
                >
                  {choice.districtId ? null : (
                    <p className={styles.textWarning}>
                      <span aria-hidden="true">! </span>
                      {copy.noDistrictWarning}
                    </p>
                  )}
                </DistrictPicker>
              ) : measure?.scope === "city" ? (
                <p className={styles.slotScope}>{copy.wholeCity}</p>
              ) : null}
            </li>
          );
        })}
        {Array.from({ length: emptySlots }, (_, offset) => (
          <li key={`empty-${offset}`} className={styles.slot} data-state="empty">
            {copy.emptySlot}
          </li>
        ))}
      </ol>

      {potentialSynergies.length > 0 ? <p className={styles.synergy}>{copy.traySynergy(potentialSynergies)}</p> : null}

      <div id={`${id}-summary`} ref={summaryRef} tabIndex={-1} className={styles.summary}>
        {blockingIssues.length > 0 ? (
          <>
            <h3 className={styles.summaryTitle}>{copy.blockersTitle}</h3>
            <ul className={styles.reasons}>
              {blockingIssues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <span aria-hidden="true">✕ </span>
                  {describe(issue)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {progressIssue ? (
          <p className={styles.textWarning}>
            <span aria-hidden="true">! </span>
            {describe(progressIssue)}
          </p>
        ) : null}
      </div>

      <Button
        size="lg"
        fullWidth
        className={styles.evaluate}
        busy={isEvaluating}
        aria-disabled={!validation.canSubmit || isEvaluating}
        aria-describedby={`${id}-summary`}
        onClick={onEvaluate}
      >
        {isEvaluating ? copy.evaluating : copy.evaluate}
      </Button>
    </aside>
  );
}
