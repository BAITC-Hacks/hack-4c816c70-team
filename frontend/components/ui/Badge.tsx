import type { ComponentPropsWithRef } from "react";
import styles from "./Badge.module.css";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "accent" | "warning" | "danger" | "inverse";

export interface BadgeProps extends ComponentPropsWithRef<"span"> {
  /** Цвет никогда не единственный сигнал: текст бейджа должен называть состояние. */
  readonly tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <span {...rest} className={cx(styles.badge, styles[tone], className)} />;
}
