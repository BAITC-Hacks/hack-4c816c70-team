import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";
import { cx } from "./cx";

export interface SkeletonProps {
  readonly width?: CSSProperties["width"];
  readonly height?: CSSProperties["height"];
  readonly shape?: "line" | "block" | "circle";
  readonly className?: string;
}

/** Декоративная заглушка. Состояние загрузки объявляет родитель через live region. */
export function Skeleton({ width = "100%", height, shape = "line", className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeleton, styles[shape], className)}
      style={{ width, height }}
    />
  );
}
