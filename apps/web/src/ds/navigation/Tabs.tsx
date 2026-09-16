"use client";

import type { CSSProperties } from "react";

export interface TabItem {
  value: string;
  label: string;
  /** Trailing count, e.g. the number of queued redemptions. */
  count?: number;
}

export interface TabsProps {
  value: string;
  onChange?: (value: string) => void;
  tabs?: (TabItem | string)[];
  style?: CSSProperties;
}

/** Underline tabs for switching views inside a screen. */
export function Tabs({ value, onChange, tabs = [], style }: TabsProps) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: "var(--sp-6)",
        borderBottom: "var(--bw-1) solid var(--border-subtle)",
        ...style,
      }}
    >
      {tabs.map((t) => {
        const tab: TabItem = typeof t === "string" ? { value: t, label: t } : t;
        const on = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange && onChange(tab.value)}
            style={{
              position: "relative",
              border: "none",
              background: "transparent",
              padding: "0 0 10px",
              cursor: "pointer",
              font: "var(--fw-medium) var(--fs-body)/1 var(--font-ui)",
              color: on ? "var(--text-strong)" : "var(--text-muted)",
              transition: "var(--t-control)",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span
                style={{ marginLeft: 6, font: "var(--type-num-sm)", color: "var(--text-faint)" }}
              >
                {tab.count}
              </span>
            )}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -1,
                height: 2,
                background: on ? "var(--accent)" : "transparent",
                borderRadius: 1,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
