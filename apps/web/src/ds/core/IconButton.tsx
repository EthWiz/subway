"use client";

import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { Icon } from "./Icon";

export interface IconButtonProps {
  /** Lucide icon name. */
  name: string;
  /** Accessible label — required, becomes aria-label and title. */
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "outline";
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  style?: CSSProperties;
}

/** Square icon-only control for toolbars, row actions and dialog dismiss. */
export function IconButton({
  name,
  label,
  size = "md",
  variant = "ghost",
  disabled = false,
  onClick,
  style,
}: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const dim = size === "sm" ? 30 : 38;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-control)",
        background:
          hover && !disabled
            ? "var(--bg-hover)"
            : variant === "outline"
              ? "var(--bg-surface)"
              : "transparent",
        border:
          variant === "outline"
            ? "var(--bw-1) solid var(--border-default)"
            : "var(--bw-1) solid transparent",
        color: "var(--text-body)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.42 : 1,
        transition: "var(--t-control)",
        ...style,
      }}
    >
      <Icon name={name} size={size === "sm" ? 14 : 16} />
    </button>
  );
}
