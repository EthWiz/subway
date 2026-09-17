import React from "react";
import { Icon } from "./Icon.jsx";

/** Removable, sentence-case pill for filters and selected pairs. */
export function Tag({ children, selected = false, onClick, onRemove, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px",
        borderRadius: "var(--radius-pill)",
        background: selected ? "var(--bg-inverse)" : hover && onClick ? "var(--bg-hover)" : "var(--bg-surface)",
        color: selected ? "var(--text-on-inverse)" : "var(--text-body)",
        border: `var(--bw-1) solid ${selected ? "var(--bg-inverse)" : "var(--border-default)"}`,
        font: "var(--type-body-sm)", whiteSpace: "nowrap", cursor: onClick ? "pointer" : "default", transition: "var(--t-control)",
        ...style,
      }}
      {...rest}
    >
      {children}
      {onRemove && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}>
          <Icon name="x" size={12} />
        </span>
      )}
    </span>
  );
}
