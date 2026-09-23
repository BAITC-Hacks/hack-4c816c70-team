"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Reveal.module.css";
import { cx } from "./cx";

/** Один общий наблюдатель на все блоки страницы. */
type Callback = () => void;
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, Callback>();

function observe(element: Element, onVisible: Callback): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onVisible();
    return () => {};
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        callbacks.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  callbacks.set(element, onVisible);
  observer.observe(element);
  return () => {
    callbacks.delete(element);
    observer?.unobserve(element);
  };
}

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  readonly as?: "div" | "section" | "article" | "li" | "header" | "footer";
  /** Порядковый номер соседа для каскада (0, 1, 2…). */
  readonly index?: number;
  readonly children: ReactNode;
}

/**
 * Блок появляется один раз при прокрутке: opacity + translateY.
 * Скрытое состояние действует только при data-motion="ready" на <html>
 * (ставит bootstrap-скрипт), поэтому без JS контент виден сразу.
 * Фокус внутри блока показывает его немедленно; reduced motion — без движения.
 */
export function Reveal({ as: Tag = "div", index = 0, className, style, children, onFocus, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    return observe(element, () => setVisible(true));
  }, [visible]);

  return (
    <Tag
      {...rest}
      ref={ref as never}
      className={cx(styles.reveal, visible && styles.visible, className)}
      style={{ ...style, "--reveal-index": index } as CSSProperties}
      onFocus={(event) => {
        setVisible(true);
        onFocus?.(event);
      }}
    >
      {children}
    </Tag>
  );
}
