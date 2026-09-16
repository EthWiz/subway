"use client";

import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: (SelectOption | string)[];
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
}

/** Native select in system chrome. */
export function Select({
  value,
  onChange,
  options = [],
  label,
  disabled = false,
  size = "md",
  style,
}: SelectProps) {
  return (
    <label style={{ display: "block", ...style }}>
      {label && (
        <span
          style={{
            display: "block",
            font: "var(--type-label)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      )}
      <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value)}
          style={{
            appearance: "none",
            width: "100%",
            height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)",
            padding: "0 30px 0 10px",
            background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
            border: "var(--bw-1) solid var(--border-default)",
            borderRadius: "var(--radius-control)",
            color: "var(--text-strong)",
            font: "var(--type-body)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {options.map((o) => {
            const opt: SelectOption = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <span
          style={{
            position: "absolute",
            right: 10,
            pointerEvents: "none",
            color: "var(--text-muted)",
            display: "inline-flex",
          }}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      </span>
    </label>
  );
}
