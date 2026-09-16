"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Mono when holding an address, a hash or calldata — never a figure a user reads. */
  mono?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
}

/** Single-line text field. */
export function Input({
  value,
  onChange,
  placeholder,
  label,
  hint,
  prefix,
  suffix,
  mono = false,
  invalid = false,
  disabled = false,
  size = "md",
  style,
}: InputProps) {
  const [focus, setFocus] = useState(false);
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
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)",
          padding: "0 10px",
          background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
          border: `var(--bw-1) solid ${invalid ? "var(--neg)" : focus ? "var(--border-loud)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-control)",
          boxShadow: focus ? "var(--ring-focus)" : "none",
          transition: "var(--t-control)",
        }}
      >
        {prefix && (
          <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>{prefix}</span>
        )}
        <input
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-strong)",
            font: mono ? "var(--type-code)" : "var(--type-body)",
          }}
        />
        {suffix && (
          <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>{suffix}</span>
        )}
      </span>
      {hint && (
        <span
          style={{
            display: "block",
            marginTop: 6,
            font: "var(--type-body-sm)",
            color: invalid ? "var(--neg)" : "var(--text-muted)",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
