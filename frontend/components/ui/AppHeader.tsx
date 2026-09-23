import type { ReactNode } from "react";
import styles from "./AppHeader.module.css";
import { cx } from "./cx";

export interface AppHeaderStep {
  readonly id: string;
  readonly label: string;
  /** Недоступный шаг остаётся видимым, но не нажимается. */
  readonly disabled?: boolean;
}

export interface AppHeaderProps {
  readonly title: string;
  readonly steps: readonly AppHeaderStep[];
  readonly activeStepId: string;
  /** Без обработчика шаги показываются как индикатор, не как кнопки. */
  readonly onStepSelect?: (stepId: string) => void;
  /** Дополнительный элемент справа, например бейдж «Демонстрационные данные». */
  readonly end?: ReactNode;
}

/** Компактная тёмная шапка с названием и тремя шагами сценария. */
export function AppHeader({ title, steps, activeStepId, onStepSelect, end }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <p className={styles.title}>
          <span className={styles.mark} aria-hidden="true" />
          {title}
        </p>
        <nav aria-label="Шаги сценария" className={styles.nav}>
          <ol className={styles.steps} role="list">
            {steps.map((step, index) => {
              const isActive = step.id === activeStepId;
              const content = (
                <>
                  <span className={styles.stepIndex} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepLabel}>{step.label}</span>
                </>
              );
              return (
                <li key={step.id} className={styles.stepItem}>
                  {onStepSelect ? (
                    <button
                      type="button"
                      className={cx(styles.step, isActive && styles.active)}
                      aria-current={isActive ? "step" : undefined}
                      disabled={step.disabled}
                      onClick={() => onStepSelect(step.id)}
                    >
                      {content}
                    </button>
                  ) : (
                    <span
                      className={cx(styles.step, isActive && styles.active)}
                      aria-current={isActive ? "step" : undefined}
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
    </header>
  );
}
