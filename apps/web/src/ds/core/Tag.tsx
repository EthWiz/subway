"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export interface TagProps {
  children?: ReactNode;
  /** Selected tags invert to ink. */
  selected?: boolean;
  onClick?: () => void;
  /** When present, renders an × affordance. */
  onRemove?: () => void;
  style?: CSSProperties;
}

/** Removable, sentence-case pill for filters and selected pairs. */
export function Tag({ children, selected = false, onClick, onRemove, style }: TagProps) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 10px",
        borderRadius: "var(--radius-pill)",
        background: selected
          ? "var(--bg-inverse)"
          : hover && onClick
            ? "var(--bg-hover)"
            : "var(--bg-surface)",
        color: selected ? "var(--text-on-inverse)" : "var(--text-body)",
        border: `var(--bw-1) solid ${selected ? "var(--bg-inverse)" : "var(--border-default)"}`,
        font: "var(--type-body-sm)",
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        transition: "var(--t-control)",
        ...style,
      }}
    >
      {children}
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}
        >
          <Icon name="x" size={12} />
        </span>
      )}
    </span>
  );
}
