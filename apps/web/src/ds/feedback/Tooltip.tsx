"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface TooltipProps {
  /** The trigger — gets a dotted underline. */
  children?: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom";
  style?: CSSProperties;
}

/** Hover/focus explanation on a definition or a figure. */
export function Tooltip({ children, content, side = "top", style }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const pos: CSSProperties =
    side === "bottom"
      ? { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span style={{ borderBottom: "1px dotted var(--border-default)", cursor: "help" }}>
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 70,
            ...pos,
            width: "max-content",
            maxWidth: 260,
            padding: "8px 10px",
            background: "var(--bg-inverse)",
            color: "var(--text-on-inverse)",
            borderRadius: "var(--r-2)",
            boxShadow: "var(--shadow-2)",
            font: "var(--type-body-sm)",
            textAlign: "left",
            fontWeight: "var(--fw-regular)",
            textTransform: "none",
            letterSpacing: "normal",
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
