import React from "react";
import { Icon } from "../core/Icon.jsx";

/** Checkbox. Used for the jurisdiction self-attestation and risk acknowledgements. */
export function Checkbox({ checked = false, onChange, label, description, disabled = false, style, ...rest }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-4)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style }} {...rest}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          flex: "0 0 auto", width: 18, height: 18, marginTop: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--r-1)", background: checked ? "var(--bg-inverse)" : "var(--bg-surface)",
          border: `var(--bw-1) solid ${checked ? "var(--bg-inverse)" : "var(--border-default)"}`,
          color: "var(--text-on-inverse)", transition: "var(--t-control)",
        }}
      >
        {checked && <Icon name="check" size={12} />}
      </span>
      {(label || description) && (
        <span>
          {label && <span style={{ display: "block", font: "var(--type-body)", color: "var(--text-strong)" }}>{label}</span>}
          {description && <span style={{ display: "block", marginTop: 2, font: "var(--type-body-sm)", color: "var(--text-muted)" }}>{description}</span>}
        </span>
      )}
    </label>
  );
}
