import React from "react";
import { Icon } from "./Icon.jsx";

/** A labelled figure. The system's main way of showing a number. */
export function Stat({ label, value, unit, delta, deltaTone, hint, size = "md", align = "left", style, ...rest }) {
  const fonts = { sm: "var(--type-num-md)", md: "var(--type-num-lg)", lg: "var(--fw-medium) var(--fs-num-xl)/1 var(--font-num)" };
  const tone = deltaTone || (typeof delta === "string" && delta.trim().startsWith("-") ? "negative" : "positive");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: align === "right" ? "flex-end" : "flex-start", ...style }} {...rest}>
      <span style={{ font: "var(--type-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6, color: "var(--text-strong)" }}>
        <span style={{ font: fonts[size], letterSpacing: "var(--ls-num)", fontVariantNumeric: "lining-nums" }}>{value}</span>
        {unit && <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>{unit}</span>}
        {delta != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, font: "var(--type-num-sm)", color: tone === "negative" ? "var(--neg)" : "var(--pos)" }}>
            <Icon name={tone === "negative" ? "arrow-down-right" : "arrow-up-right"} size={11} />
            {String(delta).replace(/^[-+]/, "")}
          </span>
        )}
      </span>
      {hint && <span style={{ font: "var(--type-body-sm)", color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}
