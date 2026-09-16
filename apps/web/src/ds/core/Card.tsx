"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface CardProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Right-aligned header slot — usually a Button or IconButton. */
  actions?: ReactNode;
  /** sunken for nested read-only blocks; accent for the one "floor NAV" style notice; inverse for marketing. */
  tone?: "default" | "sunken" | "inverse" | "accent";
  pad?: "none" | "sm" | "md" | "lg";
  /** Adds hover lift + pointer; use for whole-card links such as a vault row. */
  interactive?: boolean;
  style?: CSSProperties;
}

const TONES = {
  default: { background: "var(--bg-surface)", border: "var(--bw-1) solid var(--border-subtle)" },
  sunken: { background: "var(--bg-sunken)", border: "var(--bw-1) solid var(--border-subtle)" },
  inverse: {
    background: "var(--bg-inverse)",
    border: "var(--bw-1) solid var(--bg-inverse)",
    color: "var(--text-on-inverse)",
  },
  accent: {
    background: "var(--accent-tint)",
    border: "var(--bw-1) solid color-mix(in oklab, var(--accent) 22%, transparent)",
  },
} as const;

const PADS = {
  none: 0,
  sm: "var(--sp-4)",
  md: "var(--card-pad)",
  lg: "var(--card-pad-lg)",
} as const;

/** Paper surface that holds one idea: a vault row group, a deposit panel, a stat block. */
export function Card({
  children,
  title,
  subtitle,
  actions,
  tone = "default",
  pad = "md",
  interactive = false,
  style,
}: CardProps) {
  const [hover, setHover] = useState(false);
  return (
    <section
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: "var(--radius-card)",
        padding: PADS[pad],
        ...TONES[tone],
        boxShadow: interactive && hover ? "var(--shadow-2)" : "var(--shadow-1)",
        transform: interactive && hover ? "translateY(-1px)" : "none",
        transition: "var(--t-surface)",
        cursor: interactive ? "pointer" : undefined,
        ...style,
      }}
    >
      {(title || actions) && (
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--sp-4)",
            marginBottom: subtitle ? "var(--sp-3)" : "var(--sp-5)",
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  font: "var(--type-h3)",
                  color: tone === "inverse" ? "var(--text-on-inverse)" : "var(--text-strong)",
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  font: "var(--type-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
