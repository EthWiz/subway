import React from "react";

const STATES = {
  live: { color: "var(--state-live)", label: "Live" },
  pending: { color: "var(--state-pending)", label: "Pending" },
  paused: { color: "var(--state-paused)", label: "Paused" },
  halted: { color: "var(--state-halted)", label: "Halted" },
};

/** Dot + word state indicator for vaults, feeds, keeper and queue slots. */
export function StatusPill({ state = "live", label, pulse = false, style, ...rest }) {
  const s = STATES[state] || STATES.live;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px 0 8px",
        borderRadius: "var(--radius-pill)", background: "var(--bg-surface)",
        border: "var(--bw-1) solid var(--border-subtle)", font: "var(--type-body-sm)", color: "var(--text-body)", whiteSpace: "nowrap", ...style,
      }}
      {...rest}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: pulse ? `0 0 0 3px color-mix(in oklab, ${s.color} 22%, transparent)` : "none" }} />
      {label || s.label}
    </span>
  );
}
