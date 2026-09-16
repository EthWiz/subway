import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface KeyValueItem {
  label: string;
  value: ReactNode;
  /** Colours the value; use sparingly — PnL and funding only. */
  tone?: "default" | "positive" | "negative" | "muted";
  /** Hover note on an info glyph next to the label. */
  note?: string;
}

export interface KeyValueProps {
  items?: KeyValueItem[];
  dense?: boolean;
  style?: CSSProperties;
}

const TONES = {
  positive: "var(--pos)",
  negative: "var(--neg)",
  muted: "var(--text-muted)",
  default: "var(--text-strong)",
} as const;

/** Label/value row. The workhorse of position and policy panels. */
export function KeyValue({ items = [], dense = false, style }: KeyValueProps) {
  return (
    <dl style={{ margin: 0, display: "flex", flexDirection: "column", ...style }}>
      {items.map((it, i) => (
        <div
          key={it.label + i}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--sp-5)",
            padding: dense ? "6px 0" : "10px 0",
            borderBottom:
              i === items.length - 1 ? "none" : "var(--bw-1) solid var(--border-subtle)",
          }}
        >
          <dt
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              font: "var(--type-body-sm)",
              color: "var(--text-muted)",
            }}
          >
            {it.label}
            {it.note && (
              <span
                title={it.note}
                style={{ display: "inline-flex", opacity: 0.6, cursor: "help" }}
              >
                <Icon name="info" size={12} />
              </span>
            )}
          </dt>
          <dd
            style={{
              margin: 0,
              font: "var(--type-num-md)",
              letterSpacing: "var(--ls-num)",
              fontVariantNumeric: "lining-nums",
              color: TONES[it.tone ?? "default"],
              textAlign: "right",
            }}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
