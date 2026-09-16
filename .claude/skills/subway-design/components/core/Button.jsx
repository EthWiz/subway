import React from "react";
import { Icon } from "./Icon.jsx";

const SIZES = {
  sm: { height: "var(--control-h-sm)", padding: "0 10px", font: "var(--fw-medium) var(--fs-body-sm)/1 var(--font-ui)", gap: 6 },
  md: { height: "var(--control-h)", padding: "0 14px", font: "var(--fw-medium) var(--fs-body)/1 var(--font-ui)", gap: 8 },
  lg: { height: "var(--control-h-lg)", padding: "0 20px", font: "var(--fw-medium) var(--fs-h3)/1 var(--font-ui)", gap: 8 },
};

const VARIANTS = {
  primary: { background: "var(--accent)", color: "var(--text-on-accent)", border: "var(--bw-1) solid var(--accent)" },
  secondary: { background: "var(--bg-surface)", color: "var(--text-strong)", border: "var(--bw-1) solid var(--border-default)" },
  inverse: { background: "var(--bg-inverse)", color: "var(--text-on-inverse)", border: "var(--bw-1) solid var(--bg-inverse)" },
  ghost: { background: "transparent", color: "var(--text-strong)", border: "var(--bw-1) solid transparent" },
  danger: { background: "var(--neg-tint)", color: "var(--neg)", border: "var(--bw-1) solid color-mix(in oklab, var(--neg) 28%, transparent)" },
};

const HOVER = {
  primary: { background: "var(--accent-hover)", borderColor: "var(--accent-hover)" },
  secondary: { background: "var(--bg-hover)", borderColor: "var(--border-loud)" },
  inverse: { background: "var(--ink-1)", borderColor: "var(--ink-1)" },
  ghost: { background: "var(--bg-hover)" },
  danger: { background: "color-mix(in oklab, var(--neg) 12%, var(--neg-tint))" },
};

/** Primary action control. One primary per panel; everything else secondary or ghost. */
export function Button({
  children, variant = "primary", size = "md", icon, iconAfter, fullWidth = false,
  disabled = false, loading = false, onClick, type = "button", style, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const off = disabled || loading;
  const base = { ...VARIANTS[variant], ...SIZES[size] };
  return (
    <button
      type={type}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-control)",
        cursor: off ? "not-allowed" : "pointer",
        opacity: off ? 0.42 : 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.005em",
        transform: press && !off ? "translateY(0.5px)" : "none",
        transition: "var(--t-control), transform var(--dur-1) var(--ease-out)",
        ...base,
        ...(hover && !off ? HOVER[variant] : null),
        ...style,
      }}
      {...rest}
    >
      {loading ? <Icon name="loader" size={size === "sm" ? 13 : 15} /> : icon ? <Icon name={icon} size={size === "sm" ? 13 : 15} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === "sm" ? 13 : 15} /> : null}
    </button>
  );
}
