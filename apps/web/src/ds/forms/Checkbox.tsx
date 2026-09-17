"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
}

/** Checkbox. Used for the jurisdiction self-attestation and risk acknowledgements. */
export function Checkbox({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  style,
}: CheckboxProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-4)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 18,
          height: 18,
          marginTop: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--r-1)",
          background: checked ? "var(--bg-inverse)" : "var(--bg-surface)",
          border: `var(--bw-1) solid ${checked ? "var(--bg-inverse)" : "var(--border-default)"}`,
          color: "var(--text-on-inverse)",
          transition: "var(--t-control)",
        }}
      >
        {checked && <Icon name="check" size={12} />}
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
