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
import { DistrictPicker } from "./DistrictPicker";
import { CATEGORY_LABELS, formatUnits } from "./labels";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DecisionTrayProps {
  readonly id: string;
  readonly budget: number;
  readonly requiredChoices: number | null;
  readonly choices: readonly ChoiceDraft[];
  readonly measureById: ReadonlyMap<MeasureId, MeasureVM>;
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
  const slotCount = Math.max(requiredChoices ?? 0, choices.length);
  const emptySlots = Math.max(0, slotCount - choices.length);
  const spentShare = budget > 0 ? Math.min(1, Math.max(0, validation.provisionalSpent / budget)) : 0;
  const isOverBudget = validation.provisionalRemaining < 0;
  const blockingIssues = validation.issues.filter((issue) => !isProgressIssue(issue));
  const progressIssue = validation.issues.find(isProgressIssue);

  return (
    <aside id={id} className={styles.tray} aria-labelledby={`${id}-heading`}>
      <div className={styles.trayHeader}>
        <h2 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className={styles.trayTitle}>
          Решения акима
        </h2>
        <p className={styles.counter}>
          {choices.length} из {requiredChoices ?? "—"}
        </p>
        <Button variant="secondary" className={styles.trayClose} onClick={onClose}>
          Свернуть
        </Button>
      </div>

      <section className={styles.budget} aria-label="Предварительный бюджет">
        <div className={styles.budgetRow}>
          <span>Предварительные расходы</span>
          <strong>
            {formatUnits(validation.provisionalSpent)} из {formatUnits(budget)} ед.
          </strong>
        </div>
        <div className={styles.budgetBar} data-over={isOverBudget} aria-hidden="true">
          <span style={{ transform: `scaleX(${spentShare})` }} />
        </div>
        <div className={styles.budgetRow} data-over={isOverBudget}>
          <span>{isOverBudget ? "Превышение бюджета" : "Остаток"}</span>
          <strong>
            {isOverBudget ? <span aria-hidden="true">✕ </span> : null}
            {formatUnits(Math.abs(validation.provisionalRemaining))} ед.
          </strong>
        </div>
        <p className={styles.textMuted}>
          Предварительно по ценам каталога. Итоговые расходы и оценку рассчитывает сервер.
        </p>
      </section>

      <ol className={styles.slots}>
        {choices.map((choice, index) => {
          const measure = measureById.get(choice.measureId);
          const slotIssues = validation.issues.filter(
            (issue) => !isProgressIssue(issue) && issue.measureIds?.includes(choice.measureId),
          );
          return (
            <li key={`${choice.measureId}-${index}`} className={styles.slot} data-state={slotIssues.length > 0 ? "issue" : "ok"}>
              <div className={styles.slotHead}>
                <span className={styles.slotIndex} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.slotText}>
                  <p className={styles.cardMeta}>
                    {measure ? CATEGORY_LABELS[measure.category] : "Неизвестная мера"} · {choice.measureId}
                  </p>
                  <p className={styles.slotName}>{measure?.name ?? `Мера «${choice.measureId}»`}</p>
                </div>
                <span className={styles.slotCost}>{measure ? `${formatUnits(measure.cost)} ед.` : "—"}</span>
              </div>
              {measure?.scope === "district" ? (
                <DistrictPicker
                  label={`Район для ${measure.id}`}
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
                <p className={styles.cityNote}>Весь город</p>
              ) : null}
              <button
                type="button"
                className={styles.buttonLink}
                aria-label={`Убрать ${choice.measureId} из решений`}
                onClick={() => onRemove(choice.measureId)}
              >
                Убрать
              </button>
            </li>
          );
        })}
        {Array.from({ length: emptySlots }, (_, offset) => (
          <li key={`empty-${offset}`} className={styles.slot} data-state="empty">
            <span className={styles.slotIndex} aria-hidden="true">
              {choices.length + offset + 1}
            </span>
            <span className={styles.textMuted}>Свободный слот — добавьте меру из каталога</span>
          </li>
        ))}
      </ol>

      {potentialSynergies.length > 0 ? (
        <section className={styles.synergy} aria-label="Возможные синергии">
          <p>
            <strong>Возможная синергия:</strong>{" "}
            {potentialSynergies.map(([a, b]) => `${a} + ${b}`).join(", ")}.
          </p>
          <p className={styles.textMuted}>Справка по каталогу. Сработает ли она, покажет оценка сервера.</p>
        </section>
      ) : null}

      <div id={`${id}-summary`} ref={summaryRef} tabIndex={-1} className={styles.summary}>
        {blockingIssues.length > 0 ? (
          <>
            <h3 className={styles.summaryTitle}>
              Что мешает оценке
            </h3>
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
          <p className={styles.textMuted}>Выбранные меры сохранены. Проверьте набор и оцените снова.</p>
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
