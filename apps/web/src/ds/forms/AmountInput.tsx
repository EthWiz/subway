"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface AmountInputProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Ticker shown in the trailing chip, e.g. "USDG", "xAMC". */
  asset?: string;
  /** Formatted wallet balance shown above the field. */
  balance?: string;
  /** Feed-priced equivalent under the figure, e.g. "≈ $12,480 at feed". */
  usdValue?: ReactNode;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  hint?: ReactNode;
  onMax?: () => void;
  style?: CSSProperties;
}

/** Token amount field: big tabular figure, asset ticker, balance and MAX. */
export function AmountInput({
  value,
  onChange,
  asset,
  balance,
  usdValue,
  label,
  disabled = false,
  invalid = false,
  hint,
  onMax,
  style,
}: AmountInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        {label && (
          <span
            style={{
              font: "var(--type-label)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {label}
          </span>
        )}
        {balance != null && (
          <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>
            Balance {balance}
            {onMax && (
              <button
                type="button"
                onClick={onMax}
                style={{
                  marginLeft: 8,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  font: "var(--type-label)",
                  letterSpacing: "var(--ls-label)",
                  color: "var(--accent-ink)",
                  cursor: "pointer",
                }}
              >
                MAX
              </button>
            )}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          padding: "var(--sp-4) var(--sp-5)",
          background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
          border: `var(--bw-1) solid ${invalid ? "var(--neg)" : focus ? "var(--border-loud)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-control)",
          boxShadow: focus ? "var(--ring-focus)" : "none",
          transition: "var(--t-control)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            disabled={disabled}
            inputMode="decimal"
            placeholder="0.00"
            aria-label={label}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text-strong)",
              font: "var(--fw-medium) var(--fs-num-xl)/1.05 var(--font-num)",
              letterSpacing: "var(--ls-num)",
              fontVariantNumeric: "lining-nums",
            }}
          />
          {usdValue && (
            <div style={{ marginTop: 6, font: "var(--type-num-sm)", color: "var(--text-muted)" }}>
              {usdValue}
            </div>
          )}
        </div>
        {asset && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 30,
              padding: "0 10px",
              borderRadius: "var(--radius-control)",
              background: "var(--bg-sunken)",
              border: "var(--bw-1) solid var(--border-subtle)",
              font: "var(--fw-medium) var(--fs-body-sm)/1 var(--font-num)",
              color: "var(--text-strong)",
              whiteSpace: "nowrap",
            }}
          >
            {asset}
          </span>
        )}
      </div>
      {hint && (
        <div
          style={{
            marginTop: 6,
            font: "var(--type-body-sm)",
            color: invalid ? "var(--neg)" : "var(--text-muted)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
