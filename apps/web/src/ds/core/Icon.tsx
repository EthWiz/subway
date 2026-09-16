import type { CSSProperties } from "react";

export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "arrow-up-right", "shield-check". */
  name: string;
  /** Rendered square size in px. Default 16. */
  size?: number;
  style?: CSSProperties;
}

/**
 * Monochrome icon from the vendored Lucide set (2px stroke), masked so it
 * inherits `currentColor`.
 *
 * The system's own `Icon` derives its base path from wherever `_ds_bundle.js`
 * was loaded and probes each URL with `new Image()` before painting, because a
 * card, a kit and a consuming page all sit at different depths. Next serves the
 * SVGs from `public/icons/` at one known absolute path, so both the runtime
 * probe and the `"use client"` boundary it forced are dropped — this renders in
 * a server component and never flashes an unmasked block.
 */
export function Icon({ name, size = 16, style }: IconProps) {
  const url = `/icons/${name}.svg`;
  return (
    <span
      role="img"
      aria-hidden="true"
      data-icon={name}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flex: "0 0 auto",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
    />
  );
}
