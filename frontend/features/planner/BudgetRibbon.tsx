import type { MeasureId } from "@/lib/contracts/ui";
import { formatUnits } from "./labels";
import styles from "./planner.module.css";

export interface RibbonSegment {
  readonly measureId: MeasureId;
  readonly cost: number;
}

interface BudgetRibbonProps {
  readonly budget: number;
  readonly segments: readonly RibbonSegment[];
  /** Размер ленты задаёт вызывающий: полная в панели, тонкая в мобильной панели. */
  readonly className?: string;
}

/**
 * Бюджет как лента: каждая выбранная мера занимает долю, пропорциональную цене
 * из каталога. Это арифметика формы, не прогноз. Итоговые расходы — от сервера.
 */
export function BudgetRibbon({ budget, segments, className }: BudgetRibbonProps) {
  const spent = segments.reduce((sum, segment) => sum + segment.cost, 0);
  const scale = Math.max(budget, spent);
  const rest = Math.max(0, budget - spent);
  const limitAt = scale > 0 ? (budget / scale) * 100 : 100;
  const label =
    spent > budget
      ? `Бюджет превышен: ${formatUnits(spent)} из ${formatUnits(budget)} ед.`
      : `Распределено ${formatUnits(spent)} из ${formatUnits(budget)} ед.`;

  return (
    <div
      className={className ? `${styles.ribbon} ${className}` : styles.ribbon}
      data-over={spent > budget}
      role="img"
      aria-label={label}
    >
      {segments.map((segment, index) => (
        <span
          key={`${segment.measureId}-${index}`}
          className={styles.ribbonSegment}
          style={{ flexGrow: segment.cost }}
        >
          <span className={styles.ribbonLabel}>{segment.measureId}</span>
        </span>
      ))}
      {rest > 0 ? <span className={styles.ribbonRest} style={{ flexGrow: rest }} /> : null}
      {spent > budget ? <span className={styles.ribbonLimit} style={{ left: `${limitAt}%` }} /> : null}
    </div>
  );
}
