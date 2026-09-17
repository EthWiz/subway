"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface DataTableColumn {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  /** false renders the cell in UI type instead of mono numerics. */
  mono?: boolean;
  wrap?: boolean;
  width?: string | number;
}

export type DataTableRow = Record<string, ReactNode> & { id?: string };

export interface DataTableProps<Row extends DataTableRow = DataTableRow> {
  columns?: DataTableColumn[];
  /** Row objects keyed by column key; `id` is used as the React key. */
  rows?: Row[];
  onRowClick?: (row: Row) => void;
  emptyLabel?: string;
  style?: CSSProperties;
}

/** Flat data table: tabular numerics, hairline rows, no zebra striping. */
export function DataTable<Row extends DataTableRow>({
  columns = [],
  rows = [],
  onRowClick,
  emptyLabel = "Nothing here yet",
  style,
}: DataTableProps<Row>) {
  const [hover, setHover] = useState(-1);
  return (
    <div style={{ overflowX: "auto", ...style }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  padding: "0 var(--sp-5) var(--sp-3)",
                  font: "var(--type-label)",
                  letterSpacing: "var(--ls-label)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  borderBottom: "var(--bw-1) solid var(--border-default)",
                  whiteSpace: "nowrap",
                  width: c.width,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "var(--sp-8) var(--sp-5)",
                  textAlign: "center",
                  font: "var(--type-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={r.id || i}
              onClick={() => onRowClick && onRowClick(r)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(-1)}
              style={{
                background: hover === i && onRowClick ? "var(--bg-hover)" : "transparent",
                cursor: onRowClick ? "pointer" : "default",
                transition: "background var(--dur-1) var(--ease-out)",
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "var(--sp-4) var(--sp-5)",
                    textAlign: c.align || "left",
                    borderBottom: "var(--bw-1) solid var(--border-subtle)",
                    font: c.mono === false ? "var(--type-body)" : "var(--type-num-md)",
                    letterSpacing: c.mono === false ? "0" : "var(--ls-num)",
                    fontVariantNumeric: c.mono === false ? "normal" : "lining-nums",
                    color: "var(--text-strong)",
                    whiteSpace: c.wrap ? "normal" : "nowrap",
                  }}
                >
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
