"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
import styles from "./AppHeader.module.css";
import { uiMessages } from "./messages";
import { cx } from "./cx";

export interface AppHeaderStep {
  readonly id: string;
  readonly label: string;
  /** Недоступный пункт остаётся видимым, но не нажимается. */
  readonly disabled?: boolean;
  /** Показывается у недоступного пункта при наведении и фокусе. */
  readonly disabledReason?: string;
  /** Реальный адрес страницы: пункт становится ссылкой Next с aria-current="page". */
  readonly href?: string;
}

export interface AppHeaderProps {
  readonly title: string;
  readonly steps: readonly AppHeaderStep[];
  readonly activeStepId: string;
  /** Без href и без обработчика шаги показываются как индикатор. */
  readonly onStepSelect?: (stepId: string) => void;
  /** Справа: например, ThemeSwitcher или бейдж «Демонстрационные данные». */
  readonly end?: ReactNode;
  /** Ссылка с названия (обычно "/"). */
  readonly titleHref?: string;
}

interface IndicatorBox {
  readonly x: number;
  readonly width: number;
}

/** Липкая шапка: мягко меняет фон при прокрутке, индикатор активного пункта скользит. */
export function AppHeader({ title, steps, activeStepId, onStepSelect, end, titleHref }: AppHeaderProps) {
  const reasonPrefix = useId();
  const copy = uiMessages[useLocale().locale];
  const listRef = useRef<HTMLOListElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [indicator, setIndicator] = useState<IndicatorBox | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>("[data-active='true']");
      if (!active) {
        setIndicator(null);
        return;
      }
      const base = list.getBoundingClientRect().left;
      const box = active.getBoundingClientRect();
      setIndicator({ x: box.left - base, width: box.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeStepId, steps]);

  // Первое положение ставим без анимации, дальше индикатор скользит.
  useEffect(() => {
    if (!indicator || animated) return;
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [indicator, animated]);

  return (
    <header className={styles.header} data-scrolled={scrolled || undefined}>
      <div className={styles.inner}>
        {titleHref ? (
          <Link href={titleHref} className={styles.title}>
            <span className={styles.mark} aria-hidden="true" />
            <span className={styles.titleText}>{title}</span>
          </Link>
        ) : (
          <p className={styles.title}>
            <span className={styles.mark} aria-hidden="true" />
            <span className={styles.titleText}>{title}</span>
          </p>
        )}
        <nav aria-label={copy.navLabel} className={styles.nav}>
          <ol ref={listRef} className={styles.steps} role="list">
            {steps.map((step, index) => {
              const isActive = step.id === activeStepId;
              const current = isActive ? (step.href ? "page" : "step") : undefined;
              const reasonId = `${reasonPrefix}-${step.id}`;
              const content = (
                <>
                  <span className={styles.stepIndex} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepLabel}>{step.label}</span>
                </>
              );
              const className = cx(styles.step, isActive && styles.active);

              let control: ReactNode;
              if (step.disabled) {
                control = (
                  <span
                    className={cx(className, styles.disabled)}
                    aria-disabled="true"
                    aria-current={current}
                    tabIndex={step.disabledReason ? 0 : undefined}
                    aria-describedby={step.disabledReason ? reasonId : undefined}
                    data-active={isActive || undefined}
                  >
                    {content}
                  </span>
                );
              } else if (step.href) {
                control = (
                  <Link href={step.href} className={className} aria-current={current} data-active={isActive || undefined}>
                    {content}
                  </Link>
                );
              } else if (onStepSelect) {
                control = (
                  <button
                    type="button"
                    className={className}
                    aria-current={current}
                    data-active={isActive || undefined}
                    onClick={() => onStepSelect(step.id)}
                  >
                    {content}
                  </button>
                );
              } else {
                control = (
                  <span className={className} aria-current={current} data-active={isActive || undefined}>
                    {content}
                  </span>
                );
              }

              return (
                <li key={step.id} className={styles.stepItem}>
                  {control}
                  {step.disabled && step.disabledReason ? (
                    <span id={reasonId} role="tooltip" className={styles.reason}>
                      {step.disabledReason}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <span
            aria-hidden="true"
            className={cx(styles.indicator, animated && styles.indicatorAnimated)}
            style={
              indicator
                ? { transform: `translateX(${indicator.x}px)`, width: indicator.width, opacity: 1 }
                : { opacity: 0 }
            }
          />
        </nav>
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
    </header>
  );
}
