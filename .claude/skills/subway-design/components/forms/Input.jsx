import React from "react";

/** Single-line text field. Mono when holding an address or a number. */
export function Input({ value, onChange, placeholder, label, hint, prefix, suffix, mono = false, invalid = false, disabled = false, size = "md", style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "block", ...style }}>
      {label && <span style={{ display: "block", font: "var(--type-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{label}</span>}
      <span
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)", padding: "0 10px",
          background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
          border: `var(--bw-1) solid ${invalid ? "var(--neg)" : focus ? "var(--border-loud)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-control)",
          boxShadow: focus ? "var(--ring-focus)" : "none", transition: "var(--t-control)",
        }}
      >
        {prefix && <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
            color: "var(--text-strong)", font: mono ? "var(--type-num-md)" : "var(--type-body)",
            fontVariantNumeric: mono ? "lining-nums" : "normal",
          }}
          {...rest}
        />
        {suffix && <span style={{ font: "var(--type-num-sm)", color: "var(--text-muted)" }}>{suffix}</span>}
      </span>
      {hint && <span style={{ display: "block", marginTop: 6, font: "var(--type-body-sm)", color: invalid ? "var(--neg)" : "var(--text-muted)" }}>{hint}</span>}
    </label>
  );
}
