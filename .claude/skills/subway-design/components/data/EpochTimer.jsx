import React from "react";
import { Icon } from "../core/Icon.jsx";

/** Epoch clock for the hedged vault: progress to the next settlement plus the honest wait copy. */
export function EpochTimer({ epoch, countdown, progress = 0, note, style, ...rest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--sp-4)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--type-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>
          <Icon name="clock" size={12} /> Epoch {epoch}
        </span>
        <span style={{ font: "var(--type-num-md)", letterSpacing: "var(--ls-num)", fontVariantNumeric: "lining-nums", color: "var(--text-strong)" }}>{countdown}</span>
      </div>
      <div style={{ height: 4, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: "100%", background: "var(--accent)", transition: `width var(--dur-4) var(--ease-out)` }} />
      </div>
      {note && <span style={{ font: "var(--type-body-sm)", color: "var(--text-muted)" }}>{note}</span>}
    </div>
  );
}
