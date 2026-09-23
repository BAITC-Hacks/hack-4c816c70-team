import type { Ref } from "react";
import type {
  ChoiceDraft,
  DistrictId,
  DraftValidation,
  MeasureId,
  MeasureVM,
  SelectionIssue,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { BudgetRibbon, type RibbonSegment } from "./BudgetRibbon";
import { DistrictPicker } from "./DistrictPicker";
import { formatUnits } from "./labels";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DecisionTrayProps {
  readonly id: string;
  readonly budget: number;
  readonly requiredChoices: number | null;
  readonly choices: readonly ChoiceDraft[];
  readonly measureById: ReadonlyMap<MeasureId, MeasureVM>;
  readonly segments: readonly RibbonSegment[];
  readonly districtOptionsFor: (measureId: MeasureId) => readonly DistrictOption[];
  readonly validation: DraftValidation;
  readonly potentialSynergies: readonly (readonly [MeasureId, MeasureId])[];
  readonly isEvaluating: boolean;
  readonly serverError: string | null;
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
  budget,
  requiredChoices,
  choices,
  measureById,
  segments,
  districtOptionsFor,
  validation,
  potentialSynergies,
  isEvaluating,
  serverError,
  summaryRef,
  headingRef,
  onRemove,
  onDistrictChange,
  onEvaluate,
  onClose,
}: DecisionTrayProps) {
  const emptySlots = Math.max(0, (requiredChoices ?? 0) - choices.length);
  const isOverBudget = validation.provisionalRemaining < 0;
  const blockingIssues = validation.issues.filter((issue) => !isProgressIssue(issue));
  const progressIssue = validation.issues.find(isProgressIssue);

  return (
    <aside id={id} className={styles.tray} aria-labelledby={`${id}-heading`}>
      <div className={styles.trayHeader}>
        <h2 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className={styles.trayTitle}>
          План
        </h2>
        <p className={styles.counter}>
          <strong>{choices.length}</strong> из {requiredChoices ?? "—"}
        </p>
        <Button variant="secondary" className={styles.trayClose} onClick={onClose}>
          Свернуть
        </Button>
      </div>

      <section className={styles.budget} aria-label="Предварительный бюджет">
        <BudgetRibbon budget={budget} segments={segments} />
        <dl className={styles.budgetFigures}>
          <div>
            <dt>Потрачено</dt>
            <dd>
              <span key={validation.provisionalSpent} className={styles.flash}>
                {formatUnits(validation.provisionalSpent)}
              </span>{" "}
              из {formatUnits(budget)}
            </dd>
          </div>
          <div data-over={isOverBudget}>
            <dt>{isOverBudget ? "Превышение" : "Остаток"}</dt>
            <dd>
              {isOverBudget ? <span aria-hidden="true">✕ </span> : null}
              <span key={validation.provisionalRemaining} className={styles.flash}>
                {formatUnits(Math.abs(validation.provisionalRemaining))}
              </span>{" "}
              ед.
            </dd>
          </div>
        </dl>
        <p className={styles.textMuted}>Предварительно, по ценам каталога. Итог считает сервер.</p>
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
                <p className={styles.slotName}>{measure?.name ?? `Мера «${choice.measureId}» не найдена`}</p>
                <span className={styles.slotCost}>{measure ? formatUnits(measure.cost) : "—"}</span>
                <button
                  type="button"
                  className={styles.slotRemove}
                  aria-label={`Убрать ${choice.measureId} из плана`}
                  onClick={() => onRemove(choice.measureId)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {measure?.scope === "district" ? (
                <DistrictPicker
                  label="Район"
                  options={districtOptionsFor(measure.id)}
                  value={choice.districtId ?? ""}
                  onChange={(districtId) => onDistrictChange(measure, districtId)}
                >
                  {choice.districtId ? null : (
                    <p className={styles.textWarning}>
                      <span aria-hidden="true">! </span>
                      Район не выбран: оценка недоступна.
                    </p>
                  )}
                </DistrictPicker>
              ) : measure?.scope === "city" ? (
                <p className={styles.slotScope}>Весь город</p>
              ) : null}
            </li>
          );
        })}
        {Array.from({ length: emptySlots }, (_, offset) => (
          <li key={`empty-${offset}`} className={styles.slot} data-state="empty">
            Свободное место
          </li>
        ))}
      </ol>

      {potentialSynergies.length > 0 ? (
        <p className={styles.synergy}>
          Возможная синергия: {potentialSynergies.map(([a, b]) => `${a} и ${b}`).join(", ")}. Сработает ли она,
          покажет оценка.
        </p>
      ) : null}

      <div id={`${id}-summary`} ref={summaryRef} tabIndex={-1} className={styles.summary}>
        {blockingIssues.length > 0 ? (
          <>
            <h3 className={styles.summaryTitle}>Что мешает оценке</h3>
            <ul className={styles.reasons}>
              {blockingIssues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <span aria-hidden="true">✕ </span>
                  {issue.message}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {progressIssue ? (
          <p className={styles.textWarning}>
            <span aria-hidden="true">! </span>
            {progressIssue.message}
          </p>
        ) : null}
      </div>

      {serverError !== null ? (
        <div className={styles.serverError} role="alert">
          <p className={styles.summaryTitle}>Ответ сервера</p>
          <p>{serverError}</p>
          <p className={styles.textMuted}>План сохранён. Проверьте его и оцените снова.</p>
        </div>
      ) : null}

      <Button
        size="lg"
        fullWidth
        className={styles.evaluate}
        busy={isEvaluating}
        aria-disabled={!validation.canSubmit || isEvaluating}
        aria-describedby={`${id}-summary`}
        onClick={onEvaluate}
      >
        {isEvaluating ? "Оцениваем решения…" : "Оценить решения"}
      </Button>
    </aside>
  );
}
