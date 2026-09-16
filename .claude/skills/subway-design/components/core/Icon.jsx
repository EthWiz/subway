import React from "react";

/* Icon assets ship with the design system (assets/icons/, vendored from Lucide).
   The base is derived from wherever _ds_bundle.js was loaded, so cards, kits and
   consuming pages all resolve it regardless of depth. Override with
   window.SUBWAY_ICON_BASE if the assets live elsewhere. */
function iconBase() {
  if (typeof window !== "undefined" && window.SUBWAY_ICON_BASE) return window.SUBWAY_ICON_BASE;
  if (typeof document !== "undefined") {
    const s = Array.from(document.querySelectorAll("script[src]")).find((el) => el.src.indexOf("_ds_bundle.js") !== -1);
    if (s) return s.src.replace(/_ds_bundle\.js.*$/, "assets/icons/");
  }
  return "assets/icons/";
}

/** Monochrome icon from the vendored Lucide set (2px stroke), masked so it inherits currentColor. */
export function Icon({ name, size = 16, style, ...rest }) {
  const url = iconBase() + name + ".svg";
  const [ok, setOk] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setOk(true);
    img.onerror = () => live && setOk(false);
    img.src = url;
    return () => { live = false; };
  }, [url]);
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
        // Never paint a filled block: the colour only arrives once the mask has loaded.
        backgroundColor: ok ? "currentColor" : "transparent",
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
      {...rest}
    />
  );
}
