"use client";

import type { CSSProperties, ReactNode } from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
}

/** Binary toggle. In product it drives hedged/unhedged and auto-compound. */
export function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  style,
}: SwitchProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: description ? "flex-start" : "center",
        gap: "var(--sp-4)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          flex: "0 0 auto",
          width: 38,
          height: 22,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent)" : "var(--paper-3)",
          border: `var(--bw-1) solid ${checked ? "var(--accent)" : "var(--border-default)"}`,
          transition: "var(--t-control)",
          marginTop: description ? 2 : 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "var(--radius-pill)",
            background: "var(--paper-0)",
            boxShadow: "var(--shadow-1)",
            transition: "left var(--dur-2) var(--ease-out)",
          }}
        />
      </span>
      {(label || description) && (
        <span>
          {label && (
            <span
              style={{ display: "block", font: "var(--type-body)", color: "var(--text-strong)" }}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              style={{
                display: "block",
                marginTop: 2,
                font: "var(--type-body-sm)",
                color: "var(--text-muted)",
              }}
            >
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
