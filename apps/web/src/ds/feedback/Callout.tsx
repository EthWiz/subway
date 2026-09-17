import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface CalloutProps {
  children?: ReactNode;
  title?: ReactNode;
  tone?: "neutral" | "info" | "warning" | "danger" | "positive";
  /** Overrides the tone's default Lucide glyph. */
  icon?: string;
  /** Button slot under the body. */
  action?: ReactNode;
  style?: CSSProperties;
}

const TONES = {
  neutral: {
    bg: "var(--bg-sunken)",
    fg: "var(--text-body)",
    line: "var(--border-default)",
    icon: "info",
  },
  info: {
    bg: "var(--info-tint)",
    fg: "var(--info)",
    line: "color-mix(in oklab, var(--info) 26%, transparent)",
    icon: "info",
  },
  warning: {
    bg: "var(--warn-tint)",
    fg: "var(--warn)",
    line: "color-mix(in oklab, var(--warn) 30%, transparent)",
    icon: "triangle-alert",
  },
  danger: {
    bg: "var(--neg-tint)",
    fg: "var(--neg)",
    line: "color-mix(in oklab, var(--neg) 30%, transparent)",
    icon: "octagon-alert",
  },
  positive: {
    bg: "var(--pos-tint)",
    fg: "var(--pos)",
    line: "color-mix(in oklab, var(--pos) 26%, transparent)",
    icon: "circle-check",
  },
} as const;

/** Stated risk or mechanic. The brand puts these in the flow, not in fine print. */
export function Callout({ children, title, tone = "neutral", icon, action, style }: CalloutProps) {
  const t = TONES[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--sp-4)",
        padding: "var(--sp-4) var(--sp-5)",
        background: t.bg,
        border: `var(--bw-1) solid ${t.line}`,
        borderRadius: "var(--r-3)",
        ...style,
      }}
    >
      <span style={{ color: t.fg, marginTop: 2 }}>
        <Icon name={icon || t.icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              font: "var(--fw-semibold) var(--fs-body)/1.35 var(--font-ui)",
              color: tone === "neutral" ? "var(--text-strong)" : t.fg,
              marginBottom: 3,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ font: "var(--type-body-sm)", color: "var(--text-body)" }}>{children}</div>
        {action && <div style={{ marginTop: "var(--sp-4)" }}>{action}</div>}
      </div>
    </div>
  );
}
