import type { CSSProperties } from "react";

export interface RangeMeterProps {
  /** Numeric range bounds used to place the price marker. */
  lower: number;
  upper: number;
  /** Current feed price — never the pool tick. */
  price: number;
  lowerLabel?: string;
  upperLabel?: string;
  /** Centre caption, e.g. "$121.40 feed". */
  priceLabel?: string;
  /** Out of range switches the band from positive green to warning amber. */
  inRange?: boolean;
  height?: number;
  style?: CSSProperties;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Concentrated-range bar: lower/upper bounds, the feed price marker, in/out of range. */
export function RangeMeter({
  lower,
  upper,
  price,
  lowerLabel,
  upperLabel,
  priceLabel,
  inRange = true,
  height = 10,
  style,
}: RangeMeterProps) {
  const span = upper - lower;
  const pct = span > 0 ? clamp(((price - lower) / span) * 100) : 50;
  const band = inRange ? "var(--pos)" : "var(--warn)";
  return (
    <div style={style}>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: "var(--radius-pill)",
          background: "var(--bg-sunken)",
          border: "var(--bw-1) solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "0 12%",
            borderRadius: "var(--radius-pill)",
            background: `color-mix(in oklab, ${band} 22%, transparent)`,
            borderLeft: `var(--bw-2) solid ${band}`,
            borderRight: `var(--bw-2) solid ${band}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -4,
            bottom: -4,
            left: `calc(${pct}% - 1px)`,
            width: 2,
            background: "var(--ink-0)",
            borderRadius: 1,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          font: "var(--type-num-sm)",
          color: "var(--text-muted)",
        }}
      >
        <span>{lowerLabel != null ? lowerLabel : lower}</span>
        {priceLabel != null && <span style={{ color: "var(--text-strong)" }}>{priceLabel}</span>}
        <span>{upperLabel != null ? upperLabel : upper}</span>
      </div>
    </div>
  );
}
