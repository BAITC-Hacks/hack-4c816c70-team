"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./Select.module.css";

interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly lang?: string;
}

interface SelectProps {
  readonly id?: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly ariaLabel?: string;
  readonly labelledBy?: string;
  readonly describedBy?: string;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly displayValue?: string;
}

/** Select-only combobox. Focus stays on the trigger; the popup escapes scrolling trays. */
export function Select({ id, value, options, onChange, ariaLabel, labelledBy, describedBy, invalid, disabled, compact, displayValue }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-options`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const expanded = open && !disabled;

  function show() {
    if (trigger.current?.matches(":disabled")) return;
    setActive(selected >= 0 ? selected : Math.max(0, options.findIndex((option) => !option.disabled)));
    search.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || trigger.current?.matches(":disabled")) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!expanded) return;
    function position() {
      if (!trigger.current || !list.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const topEdge = viewport?.offsetTop ?? 0;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);
      const width = Math.min(Math.max(rect.width, 180), document.documentElement.clientWidth - 24);
      const below = bottomEdge - rect.bottom - 12;
      const above = rect.top - topEdge - 12;
      const up = below < Math.min(300, list.current.scrollHeight) && above > below;
      const height = Math.max(44, Math.min(320, up ? above : below));
      Object.assign(list.current.style, {
        width: `${width}px`,
        left: `${Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12))}px`,
        top: `${up ? Math.max(topEdge + 8, rect.top - Math.min(height, list.current.scrollHeight) - 6) : rect.bottom + 6}px`,
        maxHeight: `${height}px`,
      });
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [expanded, options.length]);

  useEffect(() => {
    if (!expanded) return;
    const option = list.current?.children[active] as HTMLElement | undefined;
    if (option && list.current) {
      if (option.offsetTop < list.current.scrollTop) list.current.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.current.scrollTop + list.current.clientHeight) {
        list.current.scrollTop = option.offsetTop + option.offsetHeight - list.current.clientHeight;
      }
    }
  }, [expanded, active]);

  useEffect(() => {
    if (!expanded) return;
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") { setOpen(false); return; }
    if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!expanded) { show(); return; }
      if (event.key === "Enter" || event.key === " ") { choose(active); return; }
      const backwards = event.key === "ArrowUp" || event.key === "End";
      const step = backwards ? -1 : 1;
      let next = event.key === "Home" ? -1 : event.key === "End" ? options.length : active;
      for (let i = 0; i < options.length; i++) {
        next = (next + step + options.length) % options.length;
        if (!options[next].disabled) { setActive(next); break; }
      }
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!expanded) show();
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : "") + event.key.toLocaleLowerCase();
      search.current = { text, time: now };
      const prefix = [...text].every((letter) => letter === text[0]) ? text[0] : text;
      for (let i = 1; i <= options.length; i++) {
        const index = (active + i) % options.length;
        if (!options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(prefix)) { setActive(index); break; }
      }
    }
  }

  return <>
    <button ref={trigger} id={controlId} type="button" role="combobox" className={styles.trigger} data-compact={compact || undefined}
      disabled={disabled} aria-label={ariaLabel} aria-labelledby={labelledBy} aria-describedby={describedBy}
      aria-invalid={invalid || undefined} aria-haspopup="listbox" aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
      onClick={() => expanded ? setOpen(false) : show()} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}>
      <span className={styles.value}>{displayValue ?? options[selected]?.label ?? value}</span>
      <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {expanded && createPortal(<div ref={list} id={listId} role="listbox" className={styles.menu} aria-label={ariaLabel} aria-labelledby={labelledBy}>
      {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}
        aria-disabled={option.disabled || undefined} lang={option.lang} className={styles.option} data-active={index === active || undefined}
        onPointerMove={() => { if (!option.disabled) setActive(index); }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(index)}>
        <span>{option.label}</span><span className={styles.check} aria-hidden="true">{option.value === value ? "✓" : ""}</span>
      </div>)}
    </div>, document.body)}
  </>;
}
