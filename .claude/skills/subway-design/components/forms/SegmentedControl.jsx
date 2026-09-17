import React from "react";

/** Two or three mutually exclusive modes. The hedged/unhedged switcher. */
export function SegmentedControl({ value, onChange, options = [], size = "md", fullWidth = false, style, ...rest }) {
  return (
    <div
      role="tablist"
      style={{
        display: fullWidth ? "grid" : "inline-grid", gridAutoFlow: "column",
        gridAutoColumns: fullWidth ? "1fr" : "auto", gap: 2, padding: 2,
        background: "var(--bg-sunken)", border: "var(--bw-1) solid var(--border-subtle)",
        borderRadius: "var(--radius-control)", ...style,
      }}
      {...rest}
    >
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(opt.value)}
            style={{
              height: size === "sm" ? 26 : 32, padding: "0 14px", border: "none",
              borderRadius: "var(--r-1)", cursor: "pointer",
              background: on ? "var(--bg-surface)" : "transparent",
              boxShadow: on ? "var(--shadow-1)" : "none",
              color: on ? "var(--text-strong)" : "var(--text-muted)",
              font: `var(--fw-medium) ${size === "sm" ? "var(--fs-body-sm)" : "var(--fs-body)"}/1 var(--font-ui)`,
              transition: "var(--t-control)",
            }}
          >
            {opt.label}
            {opt.sublabel && <span style={{ marginLeft: 6, font: "var(--type-num-sm)", color: "var(--text-faint)" }}>{opt.sublabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
