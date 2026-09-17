import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export interface BadgeProps {
  children?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "info" | "accent";
  /** Lucide icon name rendered at 11px before the label. */
  icon?: string;
  /** Mono uppercase with tracking (default) or sentence case. */
  uppercase?: boolean;
  style?: CSSProperties;
}

const TONES = {
  neutral: {
    background: "var(--bg-sunken)",
    color: "var(--text-body)",
    border: "var(--border-subtle)",
  },
  positive: {
    background: "var(--pos-tint)",
    color: "var(--pos)",
    border: "color-mix(in oklab, var(--pos) 24%, transparent)",
  },
  negative: {
    background: "var(--neg-tint)",
    color: "var(--neg)",
    border: "color-mix(in oklab, var(--neg) 24%, transparent)",
  },
  warning: {
    background: "var(--warn-tint)",
    color: "var(--warn)",
    border: "color-mix(in oklab, var(--warn) 24%, transparent)",
  },
  info: {
    background: "var(--info-tint)",
    color: "var(--info)",
    border: "color-mix(in oklab, var(--info) 24%, transparent)",
  },
  accent: {
    background: "var(--accent-tint)",
    color: "var(--accent-ink)",
    border: "color-mix(in oklab, var(--accent) 26%, transparent)",
  },
} as const;

/** Small status label: vault state, phase gate, "Phase 3", "not deployed". */
export function Badge({ children, tone = "neutral", icon, uppercase = true, style }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 7px",
        borderRadius: "var(--radius-badge)",
        background: t.background,
        color: t.color,
        border: `var(--bw-1) solid ${t.border}`,
        font: "var(--type-label)",
        letterSpacing: uppercase ? "var(--ls-label)" : "0",
        textTransform: uppercase ? "uppercase" : "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}
