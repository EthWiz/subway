import React from "react";

/** Hover/focus explanation on a definition or a figure. */
export function Tooltip({ children, content, side = "top", style, ...rest }) {
  const [open, setOpen] = React.useState(false);
  const pos = side === "bottom"
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
      {...rest}
    >
      <span style={{ borderBottom: "1px dotted var(--border-default)", cursor: "help" }}>{children}</span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", zIndex: 70, ...pos, width: "max-content", maxWidth: 260,
            padding: "8px 10px", background: "var(--bg-inverse)", color: "var(--text-on-inverse)",
            borderRadius: "var(--r-2)", boxShadow: "var(--shadow-2)", font: "var(--type-body-sm)", textAlign: "left",
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
