"use client";

import { useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

export interface ButtonProps {
  children?: ReactNode;
  /** primary = the one committing action; inverse for marketing CTAs; danger for panic/exit paths. */
  variant?: "primary" | "secondary" | "inverse" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Lucide icon name rendered before the label. */
  icon?: string;
  /** Lucide icon name rendered after the label. */
  iconAfter?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: (e: MouseEvent) => void;
  style?: CSSProperties;
}

const SIZES = {
  sm: {
    height: "var(--control-h-sm)",
    padding: "0 10px",
    font: "var(--fw-medium) var(--fs-body-sm)/1 var(--font-ui)",
    gap: 6,
  },
  md: {
    height: "var(--control-h)",
    padding: "0 14px",
    font: "var(--fw-medium) var(--fs-body)/1 var(--font-ui)",
    gap: 8,
  },
  lg: {
    height: "var(--control-h-lg)",
    padding: "0 20px",
    font: "var(--fw-medium) var(--fs-h3)/1 var(--font-ui)",
    gap: 8,
  },
} as const;

const VARIANTS = {
  primary: {
    background: "var(--accent)",
    color: "var(--text-on-accent)",
    border: "var(--bw-1) solid var(--accent)",
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-strong)",
    border: "var(--bw-1) solid var(--border-default)",
  },
  inverse: {
    background: "var(--bg-inverse)",
    color: "var(--text-on-inverse)",
    border: "var(--bw-1) solid var(--bg-inverse)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-strong)",
    border: "var(--bw-1) solid transparent",
  },
  danger: {
    background: "var(--neg-tint)",
    color: "var(--neg)",
    border: "var(--bw-1) solid color-mix(in oklab, var(--neg) 28%, transparent)",
  },
} as const;

const HOVER = {
  primary: { background: "var(--accent-hover)", borderColor: "var(--accent-hover)" },
  secondary: { background: "var(--bg-hover)", borderColor: "var(--border-loud)" },
  inverse: { background: "var(--ink-1)", borderColor: "var(--ink-1)" },
  ghost: { background: "var(--bg-hover)" },
  danger: { background: "color-mix(in oklab, var(--neg) 12%, var(--neg-tint))" },
} as const;

/** Primary action control. One primary per panel; everything else secondary or ghost. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  title,
  style,
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const off = disabled || loading;
  const glyph = size === "sm" ? 13 : 15;
  return (
    <button
      type={type}
      title={title}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-control)",
        cursor: off ? "not-allowed" : "pointer",
        opacity: off ? 0.42 : 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.005em",
        transform: press && !off ? "translateY(0.5px)" : "none",
        transition: "var(--t-control), transform var(--dur-1) var(--ease-out)",
        ...VARIANTS[variant],
        ...SIZES[size],
        ...(hover && !off ? HOVER[variant] : null),
        ...style,
      }}
    >
      {loading ? (
        <Icon name="loader" size={glyph} />
      ) : icon ? (
        <Icon name={icon} size={glyph} />
      ) : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={glyph} /> : null}
    </button>
  );
}
