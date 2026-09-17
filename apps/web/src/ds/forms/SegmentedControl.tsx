"use client";

import type { CSSProperties } from "react";

export interface SegmentedOption {
  value: string;
  label: string;
  /** Small trailing gloss, e.g. the share ticker under "Hedged". */
  sublabel?: string;
  disabled?: boolean;
  /** Shown as the native tooltip — say why a disabled option is disabled. */
  title?: string;
}

export interface SegmentedControlProps {
  value: string;
  onChange?: (value: string) => void;
  options?: (SegmentedOption | string)[];
  size?: "sm" | "md";
  fullWidth?: boolean;
  /** Labels the group for screen readers. */
  ariaLabel?: string;
  style?: CSSProperties;
}

/** Two or three mutually exclusive modes. The hedged/unhedged switcher. */
export function SegmentedControl({
  value,
  onChange,
  options = [],
  size = "md",
  fullWidth = false,
  ariaLabel,
  style,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: fullWidth ? "grid" : "inline-grid",
        gridAutoFlow: "column",
        gridAutoColumns: fullWidth ? "1fr" : "auto",
        gap: 2,
        padding: 2,
        background: "var(--bg-sunken)",
        border: "var(--bw-1) solid var(--border-subtle)",
        borderRadius: "var(--radius-control)",
        ...style,
      }}
    >
      {options.map((o) => {
        const opt: SegmentedOption = typeof o === "string" ? { value: o, label: o } : o;
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={on}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange && onChange(opt.value)}
            style={{
              height: size === "sm" ? 26 : 32,
              padding: "0 14px",
              border: "none",
              borderRadius: "var(--r-1)",
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.42 : 1,
              background: on ? "var(--bg-surface)" : "transparent",
              boxShadow: on ? "var(--shadow-1)" : "none",
              color: on ? "var(--text-strong)" : "var(--text-muted)",
              font: `var(--fw-medium) ${size === "sm" ? "var(--fs-body-sm)" : "var(--fs-body)"}/1 var(--font-ui)`,
              transition: "var(--t-control)",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
            {opt.sublabel && (
              <span
                style={{ marginLeft: 6, font: "var(--type-num-sm)", color: "var(--text-faint)" }}
              >
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
