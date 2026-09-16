import React from "react";

/** Paper surface that holds one idea: a vault row group, a deposit panel, a stat block. */
export function Card({ children, title, subtitle, actions, tone = "default", pad = "md", interactive = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const tones = {
    default: { background: "var(--bg-surface)", border: "var(--bw-1) solid var(--border-subtle)" },
    sunken: { background: "var(--bg-sunken)", border: "var(--bw-1) solid var(--border-subtle)" },
    inverse: { background: "var(--bg-inverse)", border: "var(--bw-1) solid var(--bg-inverse)", color: "var(--text-on-inverse)" },
    accent: { background: "var(--accent-tint)", border: "var(--bw-1) solid color-mix(in oklab, var(--accent) 22%, transparent)" },
  };
  const pads = { none: 0, sm: "var(--sp-4)", md: "var(--card-pad)", lg: "var(--card-pad-lg)" };
  return (
    <section
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: "var(--radius-card)", padding: pads[pad], ...tones[tone],
        boxShadow: interactive && hover ? "var(--shadow-2)" : "var(--shadow-1)",
        transform: interactive && hover ? "translateY(-1px)" : "none",
        transition: "var(--t-surface)", cursor: interactive ? "pointer" : undefined, ...style,
      }}
      {...rest}
    >
      {(title || actions) && (
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-4)", marginBottom: subtitle ? "var(--sp-3)" : "var(--sp-5)" }}>
          <div>
            {title && <h3 style={{ font: "var(--type-h3)", color: tone === "inverse" ? "var(--text-on-inverse)" : "var(--text-strong)" }}>{title}</h3>}
            {subtitle && <p style={{ margin: "4px 0 0", font: "var(--type-body-sm)", color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
