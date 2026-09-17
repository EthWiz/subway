import React from "react";
import { Icon } from "../core/Icon.jsx";

/** Label/value row. The workhorse of position and policy panels. */
export function KeyValue({ items = [], dense = false, style, ...rest }) {
  return (
    <dl style={{ margin: 0, display: "flex", flexDirection: "column", ...style }} {...rest}>
      {items.map((it, i) => (
        <div
          key={it.label + i}
          style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--sp-5)",
            padding: dense ? "6px 0" : "10px 0",
            borderBottom: i === items.length - 1 ? "none" : "var(--bw-1) solid var(--border-subtle)",
          }}
        >
          <dt style={{ display: "inline-flex", alignItems: "center", gap: 5, font: "var(--type-body-sm)", color: "var(--text-muted)" }}>
            {it.label}
            {it.note && <Icon name="info" size={12} style={{ opacity: 0.6 }} title={it.note} />}
          </dt>
          <dd style={{ margin: 0, font: "var(--type-num-md)", letterSpacing: "var(--ls-num)", fontVariantNumeric: "lining-nums", color: it.tone === "positive" ? "var(--pos)" : it.tone === "negative" ? "var(--neg)" : it.tone === "muted" ? "var(--text-muted)" : "var(--text-strong)", textAlign: "right" }}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
