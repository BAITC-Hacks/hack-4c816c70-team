import { Children, cloneElement, isValidElement, type ComponentPropsWithRef, type ReactElement } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  /** Показывает индикатор ожидания и блокирует повторное нажатие. */
  readonly busy?: boolean;
  /**
   * Стиль кнопки переносится на единственный дочерний элемент, например
   * <Button asChild><Link href="/decisions">…</Link></Button>. Семантика — у ребёнка.
   */
  readonly asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  busy = false,
  asChild = false,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className);

  if (asChild) {
    const child = Children.only(children);
    if (isValidElement<{ className?: string }>(child)) {
      return cloneElement(child as ReactElement<{ className?: string }>, {
        className: cx(classes, child.props.className),
      });
    }
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={classes}
    >
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
