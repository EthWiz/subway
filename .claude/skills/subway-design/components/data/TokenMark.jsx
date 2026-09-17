import React from "react";

/** Share-token identity: square ticker tile + name. xNVDA (unhedged) vs hNVDA (hedged). */
export function TokenMark({ ticker, name, hedged = false, size = "md", style, ...rest }) {
  const dim = size === "sm" ? 26 : size === "lg" ? 44 : 34;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-4)", ...style }} {...rest}>
      <span
        style={{
          width: dim, height: dim, flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--r-2)",
          background: hedged ? "var(--bg-inverse)" : "var(--accent-tint)",
          color: hedged ? "var(--text-on-inverse)" : "var(--accent-ink)",
          border: `var(--bw-1) solid ${hedged ? "var(--bg-inverse)" : "color-mix(in oklab, var(--accent) 24%, transparent)"}`,
          font: `var(--fw-semibold) ${size === "lg" ? "15px" : size === "sm" ? "10px" : "12px"}/1 var(--font-num)`,
        }}
      >
        {hedged ? "h" : "x"}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ font: `var(--fw-medium) ${size === "lg" ? "var(--fs-h2)" : "var(--fs-body)"}/1.2 var(--font-num)`, color: "var(--text-strong)", letterSpacing: "var(--ls-num)" }}>
          {hedged ? "h" : "x"}{ticker}
        </span>
        {name && <span style={{ font: "var(--type-body-sm)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>}
      </span>
    </span>
  );
}
