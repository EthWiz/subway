import React from "react";
import { Button } from "../core/Button.jsx";
import { Icon } from "../core/Icon.jsx";

/** App header: serif wordmark, routes, chain, wallet. Subway has no logo mark — the wordmark is type. */
export function TopNav({ active = "vaults", onNavigate, items, address, chainLabel = "Robinhood Chain", onConnect, style, ...rest }) {
  const links = items || [
    { value: "vaults", label: "Vaults" },
    { value: "portfolio", label: "Portfolio" },
    { value: "research", label: "Research" },
    { value: "docs", label: "Docs" },
  ];
  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: "var(--sp-8)",
        height: 64, padding: "0 var(--page-pad)", background: "var(--bg-surface)",
        borderBottom: "var(--bw-1) solid var(--border-subtle)", ...style,
      }}
      {...rest}
    >
      <span style={{ font: "var(--fw-regular) 26px/1 var(--font-serif)", letterSpacing: "-0.015em", color: "var(--text-strong)" }}>
        Subway
      </span>
      <nav style={{ display: "flex", gap: "var(--sp-6)", flex: 1 }}>
        {links.map((l) => (
          <button
            key={l.value}
            onClick={() => onNavigate && onNavigate(l.value)}
            style={{
              border: "none", background: "transparent", padding: 0, cursor: "pointer",
              font: `var(--fw-medium) var(--fs-body)/1 var(--font-ui)`,
              color: l.value === active ? "var(--text-strong)" : "var(--text-muted)",
              borderBottom: l.value === active ? "var(--bw-2) solid var(--accent)" : "var(--bw-2) solid transparent",
              paddingBottom: 3, transition: "var(--t-control)",
            }}
          >
            {l.label}
          </button>
        ))}
      </nav>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: "var(--radius-control)", background: "var(--bg-sunken)", border: "var(--bw-1) solid var(--border-subtle)", font: "var(--type-body-sm)", color: "var(--text-body)", whiteSpace: "nowrap" }}>
        <Icon name="link" size={13} /> {chainLabel}
      </span>
      {address ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", borderRadius: "var(--radius-control)", border: "var(--bw-1) solid var(--border-default)", font: "var(--type-num-md)", color: "var(--text-strong)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--state-live)" }} />
          {address}
        </span>
      ) : (
        <Button onClick={onConnect} icon="wallet">Connect</Button>
      )}
    </header>
  );
}
