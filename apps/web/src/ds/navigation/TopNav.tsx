import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface TopNavItem {
  href: string;
  label: string;
}

export interface TopNavProps {
  /** Pathname of the current route; the item whose href prefixes it is underlined. */
  active?: string;
  items?: TopNavItem[];
  /** Truncated address, already formatted. Omit to render the connect slot. */
  address?: string;
  chainLabel?: string;
  /** Rendered in place of the address chip when no address is connected. */
  connectSlot?: ReactNode;
  style?: CSSProperties;
}

const DEFAULT_ITEMS: TopNavItem[] = [
  { href: "/", label: "Vaults" },
  { href: "/portfolio", label: "Portfolio" },
];

function isActive(href: string, active: string) {
  return href === "/" ? active === "/" : active.startsWith(href);
}

/**
 * App header: serif wordmark, routes, chain, wallet. Subway has no logo mark —
 * the wordmark is type.
 *
 * Adapted from the system's `TopNav` in two ways. The items are real hrefs
 * rendered as `next/link`, so routes prefetch and middle-click works. And the
 * header, chain chip and address chip carry `ds-topnav*` class hooks, because
 * the system specifies this bar only at desktop width and its single 64px row
 * overflows a phone — globals.css sheds the chips at the widths where they no
 * longer fit. The chrome is otherwise unchanged.
 */
export function TopNav({
  active = "/",
  items = DEFAULT_ITEMS,
  address,
  chainLabel = "Robinhood Chain",
  connectSlot,
  style,
}: TopNavProps) {
  return (
    <header
      className="ds-topnav"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-8)",
        height: 64,
        padding: "0 var(--page-pad)",
        background: "var(--bg-surface)",
        borderBottom: "var(--bw-1) solid var(--border-subtle)",
        ...style,
      }}
    >
      <Link
        href="/"
        className="plain-link"
        style={{
          font: "var(--fw-regular) 26px/1 var(--font-serif)",
          letterSpacing: "-0.015em",
          color: "var(--text-strong)",
        }}
      >
        Subway
      </Link>
      <nav style={{ display: "flex", gap: "var(--sp-6)", flex: 1 }}>
        {items.map((l) => {
          const on = isActive(l.href, active);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className="plain-link"
              style={{
                font: "var(--fw-medium) var(--fs-body)/1 var(--font-ui)",
                color: on ? "var(--text-strong)" : "var(--text-muted)",
                borderBottom: on
                  ? "var(--bw-2) solid var(--accent)"
                  : "var(--bw-2) solid transparent",
                paddingBottom: 3,
                transition: "var(--t-control)",
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <span
        className="ds-topnav-chain"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: "0 10px",
          borderRadius: "var(--radius-control)",
          background: "var(--bg-sunken)",
          border: "var(--bw-1) solid var(--border-subtle)",
          font: "var(--type-body-sm)",
          color: "var(--text-body)",
          whiteSpace: "nowrap",
        }}
      >
        <Icon name="link" size={13} /> {chainLabel}
      </span>
      {address ? (
        <span
          className="ds-topnav-address"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            padding: "0 12px",
            borderRadius: "var(--radius-control)",
            border: "var(--bw-1) solid var(--border-default)",
            font: "var(--type-num-md)",
            color: "var(--text-strong)",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--state-live)" }}
          />
          {address}
        </span>
      ) : (
        connectSlot
      )}
    </header>
  );
}
