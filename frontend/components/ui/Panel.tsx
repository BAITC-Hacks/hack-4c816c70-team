import type { HTMLAttributes } from "react";
import styles from "./Panel.module.css";
import { cx } from "./cx";

export type PanelTone = "surface" | "sunken" | "ink";
export type PanelPadding = "none" | "md" | "lg";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  readonly as?: "section" | "div" | "article" | "aside";
  readonly tone?: PanelTone;
  readonly padding?: PanelPadding;
}

export function Panel({
  as: Tag = "section",
  tone = "surface",
  padding = "lg",
  className,
  ...rest
}: PanelProps) {
  return (
    <Tag
      {...rest}
      className={cx(styles.panel, styles[tone], styles[`pad-${padding}`], className)}
    />
  );
}
