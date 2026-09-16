"use client";

import type { CSSProperties, ReactNode } from "react";
import { IconButton } from "../core/IconButton";

export interface DialogProps {
  open?: boolean;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  /** Right-aligned action row. */
  footer?: ReactNode;
  /** Omit to make the dialog non-dismissable (jurisdiction gate). */
  onClose?: () => void;
  width?: number;
  style?: CSSProperties;
}

/** Centred modal over a scrim. Used for confirmations and the jurisdiction gate. */
export function Dialog({
  open = true,
  title,
  subtitle,
  children,
  footer,
  onClose,
  width = 440,
  style,
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-6)",
        background: "var(--scrim)",
        backdropFilter: "var(--blur-scrim)",
        animation: "dsFade var(--dur-2) var(--ease-out)",
      }}
      onClick={onClose}
    >
      <style>
        {
          "@keyframes dsFade{from{opacity:0}to{opacity:1}}@keyframes dsRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"
        }
      </style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          background: "var(--bg-surface)",
          border: "var(--bw-1) solid var(--border-subtle)",
          borderRadius: "var(--radius-panel)",
          boxShadow: "var(--shadow-3)",
          padding: "var(--card-pad-lg)",
          animation: "dsRise var(--dur-3) var(--ease-entrance)",
          ...style,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--sp-5)",
            marginBottom: "var(--sp-5)",
          }}
        >
          <div>
            {title && (
              <h2 style={{ font: "var(--type-h2)", color: "var(--text-strong)" }}>{title}</h2>
            )}
            {subtitle && (
              <p
                style={{
                  margin: "6px 0 0",
                  font: "var(--type-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {onClose && <IconButton name="x" label="Close" onClick={onClose} />}
        </header>
        <div>{children}</div>
        {footer && (
          <footer
            style={{
              display: "flex",
              gap: "var(--sp-3)",
              justifyContent: "flex-end",
              marginTop: "var(--sp-6)",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
