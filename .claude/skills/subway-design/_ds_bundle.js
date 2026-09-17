/* @ds-bundle: {"format":4,"namespace":"SubwayDesignSystem_44ed98","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Stat","sourcePath":"components/core/Stat.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"EpochTimer","sourcePath":"components/data/EpochTimer.jsx"},{"name":"KeyValue","sourcePath":"components/data/KeyValue.jsx"},{"name":"RangeMeter","sourcePath":"components/data/RangeMeter.jsx"},{"name":"StatusPill","sourcePath":"components/data/StatusPill.jsx"},{"name":"TokenMark","sourcePath":"components/data/TokenMark.jsx"},{"name":"Callout","sourcePath":"components/feedback/Callout.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"AmountInput","sourcePath":"components/forms/AmountInput.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TopNav","sourcePath":"components/navigation/TopNav.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"d83eccbf94f2","components/core/Button.jsx":"3ace492bd0af","components/core/Card.jsx":"d87780b651ea","components/core/Icon.jsx":"9c56f2f9cf81","components/core/IconButton.jsx":"eb85a95d161a","components/core/Stat.jsx":"dced817e5595","components/core/Tag.jsx":"2cbad7a293f8","components/data/DataTable.jsx":"b3a1bdfb820c","components/data/EpochTimer.jsx":"f489747b9b59","components/data/KeyValue.jsx":"10329d55577d","components/data/RangeMeter.jsx":"24a6a8d957f4","components/data/StatusPill.jsx":"c728b4abaf12","components/data/TokenMark.jsx":"ebe5aa6e0356","components/feedback/Callout.jsx":"dfb6ded323f2","components/feedback/Dialog.jsx":"7ffeb3a3a65e","components/feedback/Tooltip.jsx":"df76dea1a67a","components/forms/AmountInput.jsx":"fd30bcf5f973","components/forms/Checkbox.jsx":"2257726ae7ef","components/forms/Input.jsx":"d228da83c126","components/forms/SegmentedControl.jsx":"5b0442e98b0d","components/forms/Select.jsx":"57febc8c47a6","components/forms/Switch.jsx":"9ef3f6089e11","components/navigation/Tabs.jsx":"3d79de1f6643","components/navigation/TopNav.jsx":"b86fcae78cb2","ui_kits/app/Portfolio.jsx":"11c7011f8d08","ui_kits/app/Shell.jsx":"91b4775e054a","ui_kits/app/VaultDetail.jsx":"ef126f5ad032","ui_kits/app/VaultList.jsx":"c2febf286379","ui_kits/app/data.js":"c071562fa387"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SubwayDesignSystem_44ed98 = window.SubwayDesignSystem_44ed98 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Paper surface that holds one idea: a vault row group, a deposit panel, a stat block. */
function Card({
  children,
  title,
  subtitle,
  actions,
  tone = "default",
  pad = "md",
  interactive = false,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const tones = {
    default: {
      background: "var(--bg-surface)",
      border: "var(--bw-1) solid var(--border-subtle)"
    },
    sunken: {
      background: "var(--bg-sunken)",
      border: "var(--bw-1) solid var(--border-subtle)"
    },
    inverse: {
      background: "var(--bg-inverse)",
      border: "var(--bw-1) solid var(--bg-inverse)",
      color: "var(--text-on-inverse)"
    },
    accent: {
      background: "var(--accent-tint)",
      border: "var(--bw-1) solid color-mix(in oklab, var(--accent) 22%, transparent)"
    }
  };
  const pads = {
    none: 0,
    sm: "var(--sp-4)",
    md: "var(--card-pad)",
    lg: "var(--card-pad-lg)"
  };
  return /*#__PURE__*/React.createElement("section", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      borderRadius: "var(--radius-card)",
      padding: pads[pad],
      ...tones[tone],
      boxShadow: interactive && hover ? "var(--shadow-2)" : "var(--shadow-1)",
      transform: interactive && hover ? "translateY(-1px)" : "none",
      transition: "var(--t-surface)",
      cursor: interactive ? "pointer" : undefined,
      ...style
    }
  }, rest), (title || actions) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--sp-4)",
      marginBottom: subtitle ? "var(--sp-3)" : "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("h3", {
    style: {
      font: "var(--type-h3)",
      color: tone === "inverse" ? "var(--text-on-inverse)" : "var(--text-strong)"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, subtitle)), actions), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Icon assets ship with the design system (assets/icons/, vendored from Lucide).
   The base is derived from wherever _ds_bundle.js was loaded, so cards, kits and
   consuming pages all resolve it regardless of depth. Override with
   window.SUBWAY_ICON_BASE if the assets live elsewhere. */
function iconBase() {
  if (typeof window !== "undefined" && window.SUBWAY_ICON_BASE) return window.SUBWAY_ICON_BASE;
  if (typeof document !== "undefined") {
    const s = Array.from(document.querySelectorAll("script[src]")).find(el => el.src.indexOf("_ds_bundle.js") !== -1);
    if (s) return s.src.replace(/_ds_bundle\.js.*$/, "assets/icons/");
  }
  return "assets/icons/";
}

/** Monochrome icon from the vendored Lucide set (2px stroke), masked so it inherits currentColor. */
function Icon({
  name,
  size = 16,
  style,
  ...rest
}) {
  const url = iconBase() + name + ".svg";
  const [ok, setOk] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setOk(true);
    img.onerror = () => live && setOk(false);
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return /*#__PURE__*/React.createElement("span", _extends({
    role: "img",
    "aria-hidden": "true",
    "data-icon": name,
    style: {
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
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    background: "var(--bg-sunken)",
    color: "var(--text-body)",
    border: "var(--border-subtle)"
  },
  positive: {
    background: "var(--pos-tint)",
    color: "var(--pos)",
    border: "color-mix(in oklab, var(--pos) 24%, transparent)"
  },
  negative: {
    background: "var(--neg-tint)",
    color: "var(--neg)",
    border: "color-mix(in oklab, var(--neg) 24%, transparent)"
  },
  warning: {
    background: "var(--warn-tint)",
    color: "var(--warn)",
    border: "color-mix(in oklab, var(--warn) 24%, transparent)"
  },
  info: {
    background: "var(--info-tint)",
    color: "var(--info)",
    border: "color-mix(in oklab, var(--info) 24%, transparent)"
  },
  accent: {
    background: "var(--accent-tint)",
    color: "var(--accent-ink)",
    border: "color-mix(in oklab, var(--accent) 26%, transparent)"
  }
};

/** Small status label: vault state, phase gate, "Phase 3", "not deployed". */
function Badge({
  children,
  tone = "neutral",
  icon,
  uppercase = true,
  style,
  ...rest
}) {
  const t = TONES[tone];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 7px",
      borderRadius: "var(--radius-badge)",
      background: t.background,
      color: t.color,
      border: `var(--bw-1) solid ${t.border}`,
      font: "var(--type-label)",
      letterSpacing: uppercase ? "var(--ls-label)" : "0",
      textTransform: uppercase ? "uppercase" : "none",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 11
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: "var(--control-h-sm)",
    padding: "0 10px",
    font: "var(--fw-medium) var(--fs-body-sm)/1 var(--font-ui)",
    gap: 6
  },
  md: {
    height: "var(--control-h)",
    padding: "0 14px",
    font: "var(--fw-medium) var(--fs-body)/1 var(--font-ui)",
    gap: 8
  },
  lg: {
    height: "var(--control-h-lg)",
    padding: "0 20px",
    font: "var(--fw-medium) var(--fs-h3)/1 var(--font-ui)",
    gap: 8
  }
};
const VARIANTS = {
  primary: {
    background: "var(--accent)",
    color: "var(--text-on-accent)",
    border: "var(--bw-1) solid var(--accent)"
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-strong)",
    border: "var(--bw-1) solid var(--border-default)"
  },
  inverse: {
    background: "var(--bg-inverse)",
    color: "var(--text-on-inverse)",
    border: "var(--bw-1) solid var(--bg-inverse)"
  },
  ghost: {
    background: "transparent",
    color: "var(--text-strong)",
    border: "var(--bw-1) solid transparent"
  },
  danger: {
    background: "var(--neg-tint)",
    color: "var(--neg)",
    border: "var(--bw-1) solid color-mix(in oklab, var(--neg) 28%, transparent)"
  }
};
const HOVER = {
  primary: {
    background: "var(--accent-hover)",
    borderColor: "var(--accent-hover)"
  },
  secondary: {
    background: "var(--bg-hover)",
    borderColor: "var(--border-loud)"
  },
  inverse: {
    background: "var(--ink-1)",
    borderColor: "var(--ink-1)"
  },
  ghost: {
    background: "var(--bg-hover)"
  },
  danger: {
    background: "color-mix(in oklab, var(--neg) 12%, var(--neg-tint))"
  }
};

/** Primary action control. One primary per panel; everything else secondary or ghost. */
function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const off = disabled || loading;
  const base = {
    ...VARIANTS[variant],
    ...SIZES[size]
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
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
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader",
    size: size === "sm" ? 13 : 15
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === "sm" ? 13 : 15
  }) : null, children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: size === "sm" ? 13 : 15
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square icon-only control for toolbars, row actions and dialog dismiss. */
function IconButton({
  name,
  label,
  size = "md",
  variant = "ghost",
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const dim = size === "sm" ? 30 : 38;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: dim,
      height: dim,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-control)",
      background: hover && !disabled ? "var(--bg-hover)" : variant === "outline" ? "var(--bg-surface)" : "transparent",
      border: variant === "outline" ? "var(--bw-1) solid var(--border-default)" : "var(--bw-1) solid transparent",
      color: "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.42 : 1,
      transition: "var(--t-control)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: name,
    size: size === "sm" ? 14 : 16
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A labelled figure. The system's main way of showing a number. */
function Stat({
  label,
  value,
  unit,
  delta,
  deltaTone,
  hint,
  size = "md",
  align = "left",
  style,
  ...rest
}) {
  const fonts = {
    sm: "var(--type-num-md)",
    md: "var(--type-num-lg)",
    lg: "var(--fw-medium) var(--fs-num-xl)/1 var(--font-num)"
  };
  const tone = deltaTone || (typeof delta === "string" && delta.trim().startsWith("-") ? "negative" : "positive");
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      alignItems: align === "right" ? "flex-end" : "flex-start",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      color: "var(--text-strong)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: fonts[size],
      letterSpacing: "var(--ls-num)",
      fontVariantNumeric: "lining-nums"
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, unit), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      font: "var(--type-num-sm)",
      color: tone === "negative" ? "var(--neg)" : "var(--pos)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: tone === "negative" ? "arrow-down-right" : "arrow-up-right",
    size: 11
  }), String(delta).replace(/^[-+]/, ""))), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Stat.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Removable, sentence-case pill for filters and selected pairs. */
function Tag({
  children,
  selected = false,
  onClick,
  onRemove,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 26,
      padding: "0 10px",
      borderRadius: "var(--radius-pill)",
      background: selected ? "var(--bg-inverse)" : hover && onClick ? "var(--bg-hover)" : "var(--bg-surface)",
      color: selected ? "var(--text-on-inverse)" : "var(--text-body)",
      border: `var(--bw-1) solid ${selected ? "var(--bg-inverse)" : "var(--border-default)"}`,
      font: "var(--type-body-sm)",
      whiteSpace: "nowrap",
      cursor: onClick ? "pointer" : "default",
      transition: "var(--t-control)",
      ...style
    }
  }, rest), children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      display: "inline-flex",
      cursor: "pointer",
      opacity: 0.7
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Flat data table: mono numerics, hairline rows, no zebra striping. */
function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  emptyLabel = "Nothing here yet",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      overflowX: "auto",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || "left",
      padding: "0 var(--sp-5) var(--sp-3)",
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      borderBottom: "var(--bw-1) solid var(--border-default)",
      whiteSpace: "nowrap",
      width: c.width
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      padding: "var(--sp-8) var(--sp-5)",
      textAlign: "center",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, emptyLabel)), rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id || i,
    onClick: () => onRowClick && onRowClick(r),
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(-1),
    style: {
      background: hover === i && onRowClick ? "var(--bg-hover)" : "transparent",
      cursor: onRowClick ? "pointer" : "default",
      transition: "background var(--dur-1) var(--ease-out)"
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      padding: "var(--sp-4) var(--sp-5)",
      textAlign: c.align || "left",
      borderBottom: "var(--bw-1) solid var(--border-subtle)",
      font: c.mono === false ? "var(--type-body)" : "var(--type-num-md)",
      letterSpacing: c.mono === false ? "0" : "var(--ls-num)",
      fontVariantNumeric: c.mono === false ? "normal" : "lining-nums",
      color: "var(--text-strong)",
      whiteSpace: c.wrap ? "normal" : "nowrap"
    }
  }, r[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/EpochTimer.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Epoch clock for the hedged vault: progress to the next settlement plus the honest wait copy. */
function EpochTimer({
  epoch,
  countdown,
  progress = 0,
  note,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 12
  }), " Epoch ", epoch), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-num-md)",
      letterSpacing: "var(--ls-num)",
      fontVariantNumeric: "lining-nums",
      color: "var(--text-strong)"
    }
  }, countdown)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      borderRadius: "var(--radius-pill)",
      background: "var(--bg-sunken)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.max(0, Math.min(100, progress))}%`,
      height: "100%",
      background: "var(--accent)",
      transition: `width var(--dur-4) var(--ease-out)`
    }
  })), note && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, note));
}
Object.assign(__ds_scope, { EpochTimer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EpochTimer.jsx", error: String((e && e.message) || e) }); }

// components/data/KeyValue.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Label/value row. The workhorse of position and policy panels. */
function KeyValue({
  items = [],
  dense = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("dl", _extends({
    style: {
      margin: 0,
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, rest), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it.label + i,
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "var(--sp-5)",
      padding: dense ? "6px 0" : "10px 0",
      borderBottom: i === items.length - 1 ? "none" : "var(--bw-1) solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, it.label, it.note && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "info",
    size: 12,
    style: {
      opacity: 0.6
    },
    title: it.note
  })), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      font: "var(--type-num-md)",
      letterSpacing: "var(--ls-num)",
      fontVariantNumeric: "lining-nums",
      color: it.tone === "positive" ? "var(--pos)" : it.tone === "negative" ? "var(--neg)" : it.tone === "muted" ? "var(--text-muted)" : "var(--text-strong)",
      textAlign: "right"
    }
  }, it.value))));
}
Object.assign(__ds_scope, { KeyValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KeyValue.jsx", error: String((e && e.message) || e) }); }

// components/data/RangeMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const clamp = n => Math.max(0, Math.min(100, n));

/** Concentrated-range bar: lower/upper bounds, the feed price marker, in/out of range. */
function RangeMeter({
  lower,
  upper,
  price,
  lowerLabel,
  upperLabel,
  priceLabel,
  inRange = true,
  height = 10,
  style,
  ...rest
}) {
  const span = upper - lower;
  const pct = span > 0 ? clamp((price - lower) / span * 100) : 50;
  const band = inRange ? "var(--pos)" : "var(--warn)";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height,
      borderRadius: "var(--radius-pill)",
      background: "var(--bg-sunken)",
      border: "var(--bw-1) solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      margin: "0 12%",
      borderRadius: "var(--radius-pill)",
      background: `color-mix(in oklab, ${band} 22%, transparent)`,
      borderLeft: `var(--bw-2) solid ${band}`,
      borderRight: `var(--bw-2) solid ${band}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -4,
      bottom: -4,
      left: `calc(${pct}% - 1px)`,
      width: 2,
      background: "var(--ink-0)",
      borderRadius: 1
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 6,
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, lowerLabel != null ? lowerLabel : lower), priceLabel != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-strong)"
    }
  }, priceLabel), /*#__PURE__*/React.createElement("span", null, upperLabel != null ? upperLabel : upper)));
}
Object.assign(__ds_scope, { RangeMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RangeMeter.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STATES = {
  live: {
    color: "var(--state-live)",
    label: "Live"
  },
  pending: {
    color: "var(--state-pending)",
    label: "Pending"
  },
  paused: {
    color: "var(--state-paused)",
    label: "Paused"
  },
  halted: {
    color: "var(--state-halted)",
    label: "Halted"
  }
};

/** Dot + word state indicator for vaults, feeds, keeper and queue slots. */
function StatusPill({
  state = "live",
  label,
  pulse = false,
  style,
  ...rest
}) {
  const s = STATES[state] || STATES.live;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 24,
      padding: "0 10px 0 8px",
      borderRadius: "var(--radius-pill)",
      background: "var(--bg-surface)",
      border: "var(--bw-1) solid var(--border-subtle)",
      font: "var(--type-body-sm)",
      color: "var(--text-body)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: s.color,
      boxShadow: pulse ? `0 0 0 3px color-mix(in oklab, ${s.color} 22%, transparent)` : "none"
    }
  }), label || s.label);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/TokenMark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Share-token identity: square ticker tile + name. xNVDA (unhedged) vs hNVDA (hedged). */
function TokenMark({
  ticker,
  name,
  hedged = false,
  size = "md",
  style,
  ...rest
}) {
  const dim = size === "sm" ? 26 : size === "lg" ? 44 : 34;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: dim,
      height: dim,
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--r-2)",
      background: hedged ? "var(--bg-inverse)" : "var(--accent-tint)",
      color: hedged ? "var(--text-on-inverse)" : "var(--accent-ink)",
      border: `var(--bw-1) solid ${hedged ? "var(--bg-inverse)" : "color-mix(in oklab, var(--accent) 24%, transparent)"}`,
      font: `var(--fw-semibold) ${size === "lg" ? "15px" : size === "sm" ? "10px" : "12px"}/1 var(--font-num)`
    }
  }, hedged ? "h" : "x"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fw-medium) ${size === "lg" ? "var(--fs-h2)" : "var(--fs-body)"}/1.2 var(--font-num)`,
      color: "var(--text-strong)",
      letterSpacing: "var(--ls-num)"
    }
  }, hedged ? "h" : "x", ticker), name && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-muted)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, name)));
}
Object.assign(__ds_scope, { TokenMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TokenMark.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Callout.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    bg: "var(--bg-sunken)",
    fg: "var(--text-body)",
    line: "var(--border-default)",
    icon: "info"
  },
  info: {
    bg: "var(--info-tint)",
    fg: "var(--info)",
    line: "color-mix(in oklab, var(--info) 26%, transparent)",
    icon: "info"
  },
  warning: {
    bg: "var(--warn-tint)",
    fg: "var(--warn)",
    line: "color-mix(in oklab, var(--warn) 30%, transparent)",
    icon: "triangle-alert"
  },
  danger: {
    bg: "var(--neg-tint)",
    fg: "var(--neg)",
    line: "color-mix(in oklab, var(--neg) 30%, transparent)",
    icon: "octagon-alert"
  },
  positive: {
    bg: "var(--pos-tint)",
    fg: "var(--pos)",
    line: "color-mix(in oklab, var(--pos) 26%, transparent)",
    icon: "circle-check"
  }
};

/** Stated risk or mechanic. The brand puts these in the flow, not in fine print. */
function Callout({
  children,
  title,
  tone = "neutral",
  icon,
  action,
  style,
  ...rest
}) {
  const t = TONES[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: "var(--sp-4)",
      padding: "var(--sp-4) var(--sp-5)",
      background: t.bg,
      border: `var(--bw-1) solid ${t.line}`,
      borderRadius: "var(--r-3)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      color: t.fg,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fw-semibold) var(--fs-body)/1.35 var(--font-ui)",
      color: tone === "neutral" ? "var(--text-strong)" : t.fg,
      marginBottom: 3
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-body)"
    }
  }, children), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-4)"
    }
  }, action)));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Callout.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Centred modal over a scrim. Used for confirmations and the jurisdiction gate. */
function Dialog({
  open = true,
  title,
  subtitle,
  children,
  footer,
  onClose,
  width = 440,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--sp-6)",
      background: "var(--scrim)",
      backdropFilter: "var(--blur-scrim)",
      animation: `dsFade var(--dur-2) var(--ease-out)`
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("style", null, "@keyframes dsFade{from{opacity:0}to{opacity:1}}@keyframes dsRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"), /*#__PURE__*/React.createElement("div", _extends({
    onClick: e => e.stopPropagation(),
    style: {
      width,
      maxWidth: "100%",
      background: "var(--bg-surface)",
      border: "var(--bw-1) solid var(--border-subtle)",
      borderRadius: "var(--radius-panel)",
      boxShadow: "var(--shadow-3)",
      padding: "var(--card-pad-lg)",
      animation: `dsRise var(--dur-3) var(--ease-entrance)`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--sp-5)",
      marginBottom: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--type-h2)",
      color: "var(--text-strong)"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, subtitle)), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    name: "x",
    label: "Close",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", null, children), footer && /*#__PURE__*/React.createElement("footer", {
    style: {
      display: "flex",
      gap: "var(--sp-3)",
      justifyContent: "flex-end",
      marginTop: "var(--sp-6)"
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Hover/focus explanation on a definition or a figure. */
function Tooltip({
  children,
  content,
  side = "top",
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const pos = side === "bottom" ? {
    top: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)"
  } : {
    bottom: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: "relative",
      display: "inline-flex",
      ...style
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    tabIndex: 0
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      borderBottom: "1px dotted var(--border-default)",
      cursor: "help"
    }
  }, children), open && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: "absolute",
      zIndex: 70,
      ...pos,
      width: "max-content",
      maxWidth: 260,
      padding: "8px 10px",
      background: "var(--bg-inverse)",
      color: "var(--text-on-inverse)",
      borderRadius: "var(--r-2)",
      boxShadow: "var(--shadow-2)",
      font: "var(--type-body-sm)",
      textAlign: "left"
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/AmountInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Token amount field: big mono figure, asset ticker, balance and MAX. */
function AmountInput({
  value,
  onChange,
  asset,
  balance,
  usdValue,
  label,
  disabled = false,
  invalid = false,
  hint,
  onMax,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label), balance != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, "Balance ", balance, onMax && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onMax,
    style: {
      marginLeft: 8,
      border: "none",
      background: "transparent",
      padding: 0,
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      color: "var(--accent-ink)",
      cursor: "pointer"
    }
  }, "MAX"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      padding: "var(--sp-4) var(--sp-5)",
      background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
      border: `var(--bw-1) solid ${invalid ? "var(--neg)" : focus ? "var(--border-loud)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-control)",
      boxShadow: focus ? "var(--ring-focus)" : "none",
      transition: "var(--t-control)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    disabled: disabled,
    inputMode: "decimal",
    placeholder: "0.00",
    style: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--text-strong)",
      font: "var(--fw-medium) var(--fs-num-xl)/1.05 var(--font-num)",
      letterSpacing: "var(--ls-num)",
      fontVariantNumeric: "lining-nums"
    }
  }, rest)), usdValue && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, usdValue)), asset && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 30,
      padding: "0 10px",
      borderRadius: "var(--radius-control)",
      background: "var(--bg-sunken)",
      border: "var(--bw-1) solid var(--border-subtle)",
      font: "var(--fw-medium) var(--fs-body-sm)/1 var(--font-num)",
      color: "var(--text-strong)"
    }
  }, asset)), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: "var(--type-body-sm)",
      color: invalid ? "var(--neg)" : "var(--text-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { AmountInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/AmountInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Checkbox. Used for the jurisdiction self-attestation and risk acknowledgements. */
function Checkbox({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "var(--sp-4)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      flex: "0 0 auto",
      width: 18,
      height: 18,
      marginTop: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--r-1)",
      background: checked ? "var(--bg-inverse)" : "var(--bg-surface)",
      border: `var(--bw-1) solid ${checked ? "var(--bg-inverse)" : "var(--border-default)"}`,
      color: "var(--text-on-inverse)",
      transition: "var(--t-control)"
    }
  }, checked && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 12
  })), (label || description) && /*#__PURE__*/React.createElement("span", null, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--type-body)",
      color: "var(--text-strong)"
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: 2,
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Single-line text field. Mono when holding an address or a number. */
function Input({
  value,
  onChange,
  placeholder,
  label,
  hint,
  prefix,
  suffix,
  mono = false,
  invalid = false,
  disabled = false,
  size = "md",
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)",
      padding: "0 10px",
      background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
      border: `var(--bw-1) solid ${invalid ? "var(--neg)" : focus ? "var(--border-loud)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-control)",
      boxShadow: focus ? "var(--ring-focus)" : "none",
      transition: "var(--t-control)"
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--text-strong)",
      font: mono ? "var(--type-num-md)" : "var(--type-body)",
      fontVariantNumeric: mono ? "lining-nums" : "normal"
    }
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-num-sm)",
      color: "var(--text-muted)"
    }
  }, suffix)), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: 6,
      font: "var(--type-body-sm)",
      color: invalid ? "var(--neg)" : "var(--text-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Two or three mutually exclusive modes. The hedged/unhedged switcher. */
function SegmentedControl({
  value,
  onChange,
  options = [],
  size = "md",
  fullWidth = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: fullWidth ? "grid" : "inline-grid",
      gridAutoFlow: "column",
      gridAutoColumns: fullWidth ? "1fr" : "auto",
      gap: 2,
      padding: 2,
      background: "var(--bg-sunken)",
      border: "var(--bw-1) solid var(--border-subtle)",
      borderRadius: "var(--radius-control)",
      ...style
    }
  }, rest), options.map(o => {
    const opt = typeof o === "string" ? {
      value: o,
      label: o
    } : o;
    const on = opt.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: opt.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(opt.value),
      style: {
        height: size === "sm" ? 26 : 32,
        padding: "0 14px",
        border: "none",
        borderRadius: "var(--r-1)",
        cursor: "pointer",
        background: on ? "var(--bg-surface)" : "transparent",
        boxShadow: on ? "var(--shadow-1)" : "none",
        color: on ? "var(--text-strong)" : "var(--text-muted)",
        font: `var(--fw-medium) ${size === "sm" ? "var(--fs-body-sm)" : "var(--fs-body)"}/1 var(--font-ui)`,
        transition: "var(--t-control)"
      }
    }, opt.label, opt.sublabel && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        font: "var(--type-num-sm)",
        color: "var(--text-faint)"
      }
    }, opt.sublabel));
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select in system chrome. */
function Select({
  value,
  onChange,
  options = [],
  label,
  disabled = false,
  size = "md",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      appearance: "none",
      width: "100%",
      height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)",
      padding: "0 30px 0 10px",
      background: disabled ? "var(--bg-sunken)" : "var(--bg-surface)",
      border: "var(--bw-1) solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      color: "var(--text-strong)",
      font: "var(--type-body)",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, rest), options.map(o => {
    const opt = typeof o === "string" ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 10,
      pointerEvents: "none",
      color: "var(--text-muted)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Binary toggle. In product it drives hedged/unhedged and auto-compound. */
function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: "flex",
      alignItems: description ? "flex-start" : "center",
      gap: "var(--sp-4)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      position: "relative",
      flex: "0 0 auto",
      width: 38,
      height: 22,
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--accent)" : "var(--paper-3)",
      border: `var(--bw-1) solid ${checked ? "var(--accent)" : "var(--border-default)"}`,
      transition: "var(--t-control)",
      marginTop: description ? 2 : 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: checked ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: "var(--radius-pill)",
      background: "var(--paper-0)",
      boxShadow: "var(--shadow-1)",
      transition: `left var(--dur-2) var(--ease-out)`
    }
  })), (label || description) && /*#__PURE__*/React.createElement("span", null, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--type-body)",
      color: "var(--text-strong)"
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: 2,
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, description)));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Underline tabs for switching views inside a screen. */
function Tabs({
  value,
  onChange,
  tabs = [],
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: "var(--sp-6)",
      borderBottom: "var(--bw-1) solid var(--border-subtle)",
      ...style
    }
  }, rest), tabs.map(t => {
    const tab = typeof t === "string" ? {
      value: t,
      label: t
    } : t;
    const on = tab.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.value,
      onClick: () => onChange && onChange(tab.value),
      style: {
        position: "relative",
        border: "none",
        background: "transparent",
        padding: "0 0 10px",
        cursor: "pointer",
        font: `var(--fw-medium) var(--fs-body)/1 var(--font-ui)`,
        color: on ? "var(--text-strong)" : "var(--text-muted)",
        transition: "var(--t-control)"
      }
    }, tab.label, tab.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        font: "var(--type-num-sm)",
        color: "var(--text-faint)"
      }
    }, tab.count), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        background: on ? "var(--accent)" : "transparent",
        borderRadius: 1
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** App header: serif wordmark, routes, chain, wallet. Subway has no logo mark — the wordmark is type. */
function TopNav({
  active = "vaults",
  onNavigate,
  items,
  address,
  chainLabel = "Robinhood Chain",
  onConnect,
  style,
  ...rest
}) {
  const links = items || [{
    value: "vaults",
    label: "Vaults"
  }, {
    value: "portfolio",
    label: "Portfolio"
  }, {
    value: "research",
    label: "Research"
  }, {
    value: "docs",
    label: "Docs"
  }];
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-8)",
      height: 64,
      padding: "0 var(--page-pad)",
      background: "var(--bg-surface)",
      borderBottom: "var(--bw-1) solid var(--border-subtle)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fw-regular) 26px/1 var(--font-serif)",
      letterSpacing: "-0.015em",
      color: "var(--text-strong)"
    }
  }, "Subway"), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: "var(--sp-6)",
      flex: 1
    }
  }, links.map(l => /*#__PURE__*/React.createElement("button", {
    key: l.value,
    onClick: () => onNavigate && onNavigate(l.value),
    style: {
      border: "none",
      background: "transparent",
      padding: 0,
      cursor: "pointer",
      font: `var(--fw-medium) var(--fs-body)/1 var(--font-ui)`,
      color: l.value === active ? "var(--text-strong)" : "var(--text-muted)",
      borderBottom: l.value === active ? "var(--bw-2) solid var(--accent)" : "var(--bw-2) solid transparent",
      paddingBottom: 3,
      transition: "var(--t-control)"
    }
  }, l.label))), /*#__PURE__*/React.createElement("span", {
    style: {
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
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "link",
    size: 13
  }), " ", chainLabel), address ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 38,
      padding: "0 12px",
      borderRadius: "var(--radius-control)",
      border: "var(--bw-1) solid var(--border-default)",
      font: "var(--type-num-md)",
      color: "var(--text-strong)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--state-live)"
    }
  }), address) : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: onConnect,
    icon: "wallet"
  }, "Connect"));
}
Object.assign(__ds_scope, { TopNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Portfolio.jsx
try { (() => {
const {
  Card,
  Stat,
  TokenMark,
  DataTable,
  KeyValue,
  Button,
  Badge,
  Callout,
  SegmentedControl,
  StatusPill,
  EpochTimer
} = window.SubwayDesignSystem_44ed98;
function Portfolio({
  onOpen
}) {
  const d = window.SUBWAY_DATA;
  const [ratio, setRatio] = React.useState("25");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    eyebrow: "Portfolio \xB7 0x4f2a\u20269c1b",
    title: "Your shares, and the hedge ratio they imply",
    lede: "Toggling hedge is a wrap or unwrap between the two share tokens. No LP position is closed or reopened.",
    aside: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: "var(--sp-8)"
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      label: "Position value",
      value: "$18,957",
      align: "right",
      delta: "+1.2%",
      hint: "feed-priced"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Implied hedge ratio",
      value: "24",
      unit: "%",
      align: "right",
      hint: "hINTC \xF7 total"
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 380px",
      gap: "var(--gutter)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--gutter)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Shares",
    subtitle: "One row per share token, per pair",
    pad: "none",
    style: {
      padding: "var(--card-pad) 0 0"
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: "mark",
      label: "Share",
      mono: false,
      width: "34%"
    }, {
      key: "balance",
      label: "Balance",
      align: "right"
    }, {
      key: "value",
      label: "Value",
      align: "right"
    }, {
      key: "pnl",
      label: "PnL",
      align: "right"
    }, {
      key: "act",
      label: "",
      align: "right",
      mono: false
    }],
    rows: d.positions.map(p => ({
      id: p.id,
      mark: /*#__PURE__*/React.createElement(TokenMark, {
        ticker: p.ticker,
        hedged: p.hedged,
        size: "sm",
        name: p.hedged ? "Hedged wrapper" : "Unhedged base vault"
      }),
      balance: p.balance,
      value: p.value,
      pnl: /*#__PURE__*/React.createElement("span", {
        style: {
          color: p.pnlTone === "negative" ? "var(--neg)" : "var(--pos)"
        }
      }, p.pnl),
      act: /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "secondary",
        onClick: () => onOpen(d.pairs.find(x => x.ticker === p.ticker))
      }, "Open")
    }))
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Redemption queue",
    subtitle: "Hedged side only"
  }, /*#__PURE__*/React.createElement(EpochTimer, {
    epoch: 412,
    countdown: "04:12:08",
    progress: 68,
    note: "Claimable slots stay claimable \u2014 there is no expiry."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: "slot",
      label: "Slot"
    }, {
      key: "shares",
      label: "Shares"
    }, {
      key: "requested",
      label: "Requested"
    }, {
      key: "status",
      label: "",
      mono: false,
      align: "right"
    }],
    rows: d.queue.map(q => ({
      ...q,
      status: q.status === "Claimable" ? /*#__PURE__*/React.createElement(Button, {
        size: "sm"
      }, "Claim") : /*#__PURE__*/React.createElement(StatusPill, {
        state: "pending",
        label: "Queued"
      })
    }))
  })), /*#__PURE__*/React.createElement(Callout, {
    tone: "info",
    title: "Exits do not depend on the pool being unwound"
  }, "An emergency exit from the hedged wrapper pays out in x-shares, not USDG \u2014 and the unhedged share is always redeemable out of the range.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--gutter)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Set hedge ratio",
    subtitle: "Wrap or unwrap, one transaction",
    pad: "lg"
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    fullWidth: true,
    value: ratio,
    onChange: setRatio,
    options: [{
      value: "0",
      label: "0%"
    }, {
      value: "25",
      label: "25%"
    }, {
      value: "50",
      label: "50%"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "Wrap",
      value: `${(Number(ratio) * 40).toFixed(0)} xINTC → hINTC`
    }, {
      label: "LP touched",
      value: "none",
      tone: "positive"
    }, {
      label: "Cap",
      value: "hINTC ≤ 50% of xINTC supply"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg"
  }, "Apply ratio")), /*#__PURE__*/React.createElement(Card, {
    title: "Collateral",
    subtitle: "Morpho Blue on Robinhood Chain",
    tone: "sunken"
  }, /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "hINTC market",
      value: "not live yet",
      tone: "muted"
    }, {
      label: "Oracle",
      value: "floor NAV via adapter"
    }, {
      label: "LLTV",
      value: "conservative, TBD"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-4)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true,
    icon: "external-link",
    disabled: true
  }, "Use as collateral")))));
}
Object.assign(window, {
  Portfolio
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Portfolio.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Shell.jsx
try { (() => {
const {
  TopNav,
  Callout,
  Button,
  Card,
  Checkbox,
  Dialog,
  KeyValue,
  Badge
} = window.SubwayDesignSystem_44ed98;
function Shell({
  route,
  onNavigate,
  address,
  onConnect,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-page)"
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    active: route,
    onNavigate: onNavigate,
    address: address,
    onConnect: onConnect,
    chainLabel: window.SUBWAY_DATA.chain
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--maxw-page)",
      margin: "0 auto",
      padding: "var(--sp-8) var(--page-pad) var(--sp-11)"
    }
  }, children));
}
function PageHead({
  eyebrow,
  title,
  lede,
  aside
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "var(--sp-8)",
      marginBottom: "var(--sp-7)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--maxw-prose)"
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      letterSpacing: "var(--ls-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: "var(--sp-3)"
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    style: {
      marginBottom: lede ? "var(--sp-3)" : 0
    }
  }, title), lede && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body)",
      color: "var(--text-body)"
    }
  }, lede)), aside);
}
function ConnectGate({
  open,
  onAccept
}) {
  const [ack, setAck] = React.useState(false);
  return /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    width: 460,
    title: "Before you connect",
    subtitle: "Robinhood Stock Tokens are issued by Robinhood Assets (Jersey) and are not offered everywhere."
  }, /*#__PURE__*/React.createElement(Callout, {
    tone: "danger",
    title: "Jurisdiction"
  }, "Not available to US, UK, Canadian or Swiss persons. Connecting is a self-attestation, checked again on deposit."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "Chain",
      value: "Robinhood Chain · 4663"
    }, {
      label: "Contracts",
      value: "Unaudited, undeployed",
      tone: "negative"
    }, {
      label: "Status",
      value: "Closed beta, own capital"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: ack,
    onChange: setAck,
    label: "I am not a US, UK, Canadian or Swiss person",
    description: "And I understand this software is unaudited."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-6)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    disabled: !ack,
    onClick: onAccept,
    icon: "wallet"
  }, "Connect wallet"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "var(--sp-4) 0 0",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)",
      textAlign: "center"
    }
  }, "Robinhood Wallet connects over WalletConnect."));
}
Object.assign(window, {
  Shell,
  PageHead,
  ConnectGate
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/VaultDetail.jsx
try { (() => {
const {
  Card,
  Button,
  SegmentedControl,
  AmountInput,
  KeyValue,
  RangeMeter,
  StatusPill,
  Stat,
  Callout,
  Tabs,
  TokenMark,
  Badge,
  EpochTimer,
  DataTable,
  Dialog,
  Tooltip,
  Switch,
  IconButton
} = window.SubwayDesignSystem_44ed98;
function DepositPanel({
  pair,
  mode
}) {
  const hedged = mode === "h";
  const [amt, setAmt] = React.useState("");
  const [stock, setStock] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [action, setAction] = React.useState("deposit");
  return /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      position: "sticky",
      top: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    fullWidth: true,
    value: action,
    onChange: setAction,
    options: [{
      value: "deposit",
      label: "Deposit"
    }, {
      value: "redeem",
      label: hedged ? "Request redemption" : "Withdraw"
    }],
    style: {
      marginBottom: "var(--sp-6)"
    }
  }), action === "deposit" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AmountInput, {
    label: "USDG",
    asset: "USDG",
    value: amt,
    onChange: setAmt,
    balance: "12,480.00",
    usdValue: "\u2248 $12,480 at feed",
    onMax: () => setAmt("12480")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-4)"
    }
  }), /*#__PURE__*/React.createElement(AmountInput, {
    label: `${pair.ticker} token`,
    asset: pair.ticker,
    value: stock,
    onChange: setStock,
    balance: "0.00",
    hint: "Single-asset is fine \u2014 the keeper rebalances the mix at the next range move."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "You receive",
      value: `≈ ${amt ? (Number(amt.replace(/,/g, "")) / 1.0412).toFixed(2) : "0.00"} ${hedged ? "h" : "x"}${pair.ticker}`
    }, {
      label: hedged ? "Minted at" : "Priced at",
      value: hedged ? "Floor NAV" : "Feed price"
    }, {
      label: "Approvals",
      value: "1 Permit2 signature"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    onClick: () => setConfirm(true),
    disabled: !amt && !stock
  }, hedged ? `Deposit into h${pair.ticker}` : `Deposit into x${pair.ticker}`)) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AmountInput, {
    label: "Shares to redeem",
    asset: `${hedged ? "h" : "x"}${pair.ticker}`,
    value: amt,
    onChange: setAmt,
    balance: "11,904.12",
    onMax: () => setAmt("11904.12")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), hedged ? /*#__PURE__*/React.createElement(Callout, {
    tone: "warning",
    title: "This queues"
  }, "Your slot settles at the next epoch NAV, after the keeper reduces the hedge pro rata and the Lighter withdrawal matures. Minutes normally; up to 14 days through the escape hatch.") : /*#__PURE__*/React.createElement(Callout, {
    tone: "positive",
    title: "Immediate"
  }, "Your shares are paid out of your pro-rata slice of the range, including your share of accrued fees. No queue, no buffer, no keeper."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    variant: hedged ? "secondary" : "primary",
    onClick: () => setConfirm(true),
    disabled: !amt
  }, hedged ? "Request redemption" : "Withdraw")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "var(--sp-4) 0 0",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, hedged ? "Wrapping does not close or reopen any LP position." : "You hold equity beta: this tracks the stock, plus fees, minus arb loss."), /*#__PURE__*/React.createElement(Dialog, {
    open: confirm,
    width: 420,
    title: action === "deposit" ? "Confirm deposit" : hedged ? "Confirm request" : "Confirm withdrawal",
    onClose: () => setConfirm(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setConfirm(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => setConfirm(false)
    }, "Sign and send"))
  }, /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "Route",
      value: hedged ? "Router → xVault → hVault" : "Router → xVault"
    }, {
      label: "Amount",
      value: `${amt || "0.00"} ${action === "deposit" ? "USDG" : (hedged ? "h" : "x") + pair.ticker}`
    }, {
      label: "Price source",
      value: "Chainlink feed"
    }, {
      label: "Recipient",
      value: "your address (no recipient parameter exists)",
      tone: "muted"
    }]
  })));
}
function VaultDetail({
  pair,
  onBack
}) {
  const [mode, setMode] = React.useState("x");
  const [tab, setTab] = React.useState("position");
  const hedged = mode === "h";
  const d = window.SUBWAY_DATA;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      marginBottom: "var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "arrow-left",
    label: "Back to vaults",
    variant: "outline",
    onClick: onBack
  }), /*#__PURE__*/React.createElement(TokenMark, {
    ticker: pair.ticker,
    hedged: hedged,
    size: "lg",
    name: pair.pool
  }), /*#__PURE__*/React.createElement(StatusPill, {
    state: pair.state,
    label: pair.stateLabel,
    pulse: pair.state === "live"
  }), !pair.hedged && /*#__PURE__*/React.createElement(Badge, {
    tone: "warning"
  }, "Hedged side unavailable"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: "var(--sp-8)"
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "TVL",
    value: pair.tvl,
    align: "right",
    size: "sm"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Fee APR 24h",
    value: pair.apr,
    align: "right",
    size: "sm",
    hint: "trailing, decays"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Share price",
    value: pair.share,
    align: "right",
    size: "sm",
    hint: hedged ? "floor NAV" : "exact, on-chain"
  }))), /*#__PURE__*/React.createElement(SegmentedControl, {
    value: mode,
    onChange: setMode,
    style: {
      marginBottom: "var(--sp-6)"
    },
    options: [{
      value: "x",
      label: "Unhedged",
      sublabel: `x${pair.ticker}`
    }, {
      value: "h",
      label: "Hedged",
      sublabel: `h${pair.ticker}`
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 380px",
      gap: "var(--gutter)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--gutter)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Range vs feed",
    subtitle: `±6% around the feed, recentred at ±3% drift · feed ${pair.feedAge} old`,
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "external-link"
    }, "Pool")
  }, /*#__PURE__*/React.createElement(RangeMeter, {
    lower: pair.lower,
    upper: pair.upper,
    price: pair.price,
    inRange: pair.state === "live",
    lowerLabel: `$${pair.lower.toFixed(2)} −6%`,
    upperLabel: `$${pair.upper.toFixed(2)} +6%`,
    priceLabel: `$${pair.price.toFixed(2)} feed`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-6)"
    }
  }), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: "position",
      label: "Position"
    }, {
      value: "policy",
      label: "Policy"
    }, {
      value: "queue",
      label: "Queue",
      count: hedged ? d.queue.length : undefined
    }, {
      value: "log",
      label: "Decisions log"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: "var(--sp-5)"
    }
  }, tab === "position" && /*#__PURE__*/React.createElement(KeyValue, {
    items: hedged ? [{
      label: "Holds",
      value: `${pair.supply} x${pair.ticker}`
    }, {
      label: "Fees, trailing 24h",
      value: pair.fees24h,
      tone: "positive"
    }, {
      label: "Impermanent loss vs hold",
      value: pair.il,
      tone: "negative"
    }, {
      label: "Hedge ratio",
      value: "0.98 of LP delta"
    }, {
      label: "Hedge PnL, unsettled",
      value: "−$204",
      tone: "negative",
      note: "Counted as zero in the floor"
    }, {
      label: "Funding, 8h",
      value: "0.021%",
      note: "Unhedges above 0.1%"
    }, {
      label: "Margin ledger",
      value: "$38,400 of $46,000 cap"
    }, {
      label: "Floor NAV vs attested",
      value: "$1.0412 / $1.0448",
      tone: "muted"
    }] : [{
      label: "Stock in range",
      value: `${pair.supply} ${pair.ticker}`
    }, {
      label: "Fees, trailing 24h",
      value: pair.fees24h,
      tone: "positive"
    }, {
      label: "Impermanent loss vs hold",
      value: pair.il,
      tone: "negative"
    }, {
      label: "Equity beta",
      value: "1.00 — tracks the stock"
    }, {
      label: "Idle balances",
      value: "$2,104 USDG"
    }, {
      label: "convertToAssets",
      value: "exact, feed-priced"
    }, {
      label: "Pool share",
      value: `${pair.cap}`
    }]
  }), tab === "policy" && /*#__PURE__*/React.createElement(KeyValue, {
    items: [{
      label: "Range preset",
      value: "±6% around feed, recenter at ±3%"
    }, {
      label: "Open gap",
      value: "pull 15 min before US open, reopen 10 min after"
    }, {
      label: "Weekend",
      value: "pull Fri 20:00 ET → Sun 20:00 ET"
    }, {
      label: "Feed staleness",
      value: "hold rebalances above 2h in RTH"
    }, {
      label: "Hedge band",
      value: "rehedge when |Δ| > 10% of notional"
    }, {
      label: "Hedge leverage",
      value: "3x · top up at 4x · alert at 5x"
    }, {
      label: "Caps",
      value: "vault ≤ 15% of pool TVL · maxMargin ≤ 40% of TVL"
    }, {
      label: "Hedged share cap",
      value: `h${pair.ticker} ≤ 50% of x${pair.ticker} supply`
    }]
  }), tab === "queue" && (hedged ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(EpochTimer, {
    epoch: pair.epoch,
    countdown: "04:12:08",
    progress: 68,
    note: "Settles daily at 21:00 ET, after the close."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-5)"
    }
  }), /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: "slot",
      label: "Slot"
    }, {
      key: "shares",
      label: "Shares"
    }, {
      key: "requested",
      label: "Requested"
    }, {
      key: "status",
      label: "Status",
      mono: false,
      align: "right"
    }],
    rows: d.queue.map(q => ({
      ...q,
      status: /*#__PURE__*/React.createElement(StatusPill, {
        state: q.state,
        label: q.status
      })
    }))
  })) : /*#__PURE__*/React.createElement(Callout, {
    tone: "positive",
    title: "No queue on the unhedged side"
  }, "Withdrawals settle out of the range synchronously. There is no epoch and no state a holder can be trapped in.")), tab === "log" && /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: "at",
      label: "Time"
    }, {
      key: "what",
      label: "Action",
      mono: false
    }, {
      key: "why",
      label: "Why",
      mono: false,
      wrap: true
    }, {
      key: "tx",
      label: "Tx",
      align: "right"
    }],
    rows: d.log
  }))), hedged ? /*#__PURE__*/React.createElement(Callout, {
    tone: "info",
    title: "Your share price is a floor"
  }, /*#__PURE__*/React.createElement(Tooltip, {
    content: "Idle balances + xShare value at the Chainlink feed + margin \xD7 (1 \u2212 haircut). Unsettled hedge PnL counts as zero."
  }, "The floor"), " can be too low, never too high. Depositors mint at it, so they are mildly underpaid \u2014 which is exactly what makes deposit-time manipulation pointless.") : /*#__PURE__*/React.createElement(Callout, {
    tone: "warning",
    title: "This is equity beta, not a stable claim"
  }, "x", pair.ticker, " tracks ", pair.ticker, ", plus fees, minus arbitrage loss. Hedging removes direction, not impermanent loss.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--gutter)"
    }
  }, /*#__PURE__*/React.createElement(DepositPanel, {
    pair: pair,
    mode: mode
  }), /*#__PURE__*/React.createElement(Card, {
    title: "Keeper",
    subtitle: "Changes shape, never destination",
    tone: "sunken"
  }, /*#__PURE__*/React.createElement(KeyValue, {
    dense: true,
    items: [{
      label: "Role",
      value: "bounded operator"
    }, {
      label: "Can",
      value: "range, hedge size, margin within cap"
    }, {
      label: "Cannot",
      value: "move funds anywhere"
    }, {
      label: "Lighter key",
      value: "trade-only by construction"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--sp-4)"
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: true,
    label: "Auto-compound fees",
    description: "Fees return to the range at the next move."
  })))));
}
Object.assign(window, {
  VaultDetail,
  DepositPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/VaultDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/VaultList.jsx
try { (() => {
const {
  DataTable,
  TokenMark,
  StatusPill,
  Stat,
  Card,
  Tag,
  Callout,
  Badge,
  Button
} = window.SubwayDesignSystem_44ed98;
function VaultList({
  onOpen
}) {
  const [filter, setFilter] = React.useState("all");
  const pairs = window.SUBWAY_DATA.pairs;
  const shown = filter === "hedgeable" ? pairs.filter(p => p.hedged) : filter === "live" ? pairs.filter(p => p.state === "live") : pairs;
  const columns = [{
    key: "pair",
    label: "Share",
    mono: false,
    width: "30%"
  }, {
    key: "tvl",
    label: "TVL",
    align: "right"
  }, {
    key: "apr",
    label: "Fee APR 24h",
    align: "right"
  }, {
    key: "hedge",
    label: "Hedge depth",
    align: "right"
  }, {
    key: "share",
    label: "Share price",
    align: "right"
  }, {
    key: "state",
    label: "State",
    align: "right",
    mono: false
  }];
  const rows = shown.map(p => ({
    id: p.id,
    pair: /*#__PURE__*/React.createElement(TokenMark, {
      ticker: p.ticker,
      size: "sm",
      name: p.pool
    }),
    tvl: p.tvl,
    apr: p.apr,
    hedge: p.hedge,
    share: p.share,
    state: /*#__PURE__*/React.createElement(StatusPill, {
      state: p.state,
      label: p.stateLabel
    }),
    _pair: p
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    eyebrow: "Vaults \xB7 Robinhood Chain 4663",
    title: "LP a stock token. Keep the fees, drop the direction.",
    lede: "Deposit a Robinhood Stock Token, USDG, or both. You receive a fungible share: xNVDA is equity beta plus fees, hNVDA is the same position with the delta hedged on Lighter.",
    aside: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: "var(--sp-8)"
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      label: "TVL, all vaults",
      value: "$689,380",
      align: "right",
      hint: "closed beta, own capital"
    }), /*#__PURE__*/React.createElement(Stat, {
      label: "Names cleared",
      value: "3 / 194",
      align: "right",
      hint: "of 18 hedgeable"
    }))
  }), /*#__PURE__*/React.createElement(Callout, {
    tone: "warning",
    title: "Pre-launch. Nothing is deployed and no pair has been shown to be profitable.",
    style: {
      marginBottom: "var(--sp-7)"
    }
  }, "The evidence gate rejected the three pairs this project started from. The figures below are from a 15-minute pre-open window and are extrapolations, not returns."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      marginBottom: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    selected: filter === "all",
    onClick: () => setFilter("all")
  }, "All pairs"), /*#__PURE__*/React.createElement(Tag, {
    selected: filter === "hedgeable",
    onClick: () => setFilter("hedgeable")
  }, "Hedgeable"), /*#__PURE__*/React.createElement(Tag, {
    selected: filter === "live",
    onClick: () => setFilter("live")
  }, "In range"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      font: "var(--type-body-sm)",
      color: "var(--text-muted)"
    }
  }, "Screened 2026-09-16 \xB7 194 registered tokens, 57 Lighter RH perps")), /*#__PURE__*/React.createElement(Card, {
    pad: "none",
    style: {
      padding: "var(--sp-5) 0 0",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: rows,
    onRowClick: r => onOpen(r._pair)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0,1fr))",
      gap: "var(--gutter)",
      marginTop: "var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Shares are the product",
    subtitle: "ERC-4626, one per pair"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body-sm)",
      color: "var(--text-body)"
    }
  }, "A pooled vault mints a token you can post as collateral or wrap. Per-user vaults cannot produce that.")), /*#__PURE__*/React.createElement(Card, {
    title: "Priced at the feed",
    subtitle: "Never the pool tick"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body-sm)",
      color: "var(--text-body)"
    }
  }, "A pool tick is something an attacker can move with capital. A share price built on one is a share price they can print.")), /*#__PURE__*/React.createElement(Card, {
    title: "No operator custody",
    subtitle: "Lighter account owned by the vault"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body-sm)",
      color: "var(--text-body)"
    }
  }, "Secure withdrawals land only at the L1 owner, which is the contract. The keeper's key is trade-only by construction."))));
}
Object.assign(window, {
  VaultList
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/VaultList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
window.SUBWAY_DATA = {
  chain: "Robinhood Chain",
  address: "0x4f2a…9c1b",
  pairs: [{
    id: "intc",
    ticker: "INTC",
    pool: "INTC / USDG · v3 0.30%",
    tvl: "$412,800",
    apr: "6.1%",
    state: "live",
    stateLabel: "In range",
    price: 24.18,
    lower: 22.73,
    upper: 25.63,
    feedAge: "38s",
    hedge: "$3.1M/24h",
    hedged: true,
    fees24h: "+$1,142",
    il: "−$486",
    share: "$1.0412",
    supply: "396,480",
    cap: "15% of pool TVL",
    epoch: 412
  }, {
    id: "meta",
    ticker: "META",
    pool: "META / USDG · v3 0.30%",
    tvl: "$188,400",
    apr: "4.4%",
    state: "live",
    stateLabel: "In range",
    price: 742.10,
    lower: 697.57,
    upper: 786.63,
    feedAge: "12s",
    hedge: "$11.4M/24h",
    hedged: true,
    fees24h: "+$412",
    il: "−$180",
    share: "$1.0088",
    supply: "186,760",
    cap: "15% of pool TVL",
    epoch: 412
  }, {
    id: "spcx",
    ticker: "SPCX",
    pool: "SPCX / USDG · v3 1.00%",
    tvl: "$61,200",
    apr: "18.2%",
    state: "pending",
    stateLabel: "Pre-open pull",
    price: 88.40,
    lower: 83.10,
    upper: 93.70,
    feedAge: "2m",
    hedge: "$1.2M/24h",
    hedged: true,
    fees24h: "+$308",
    il: "−$96",
    share: "$1.0031",
    supply: "61,010",
    cap: "15% of pool TVL",
    epoch: 412
  }, {
    id: "amc",
    ticker: "AMC",
    pool: "AMC / USDG · v3 0.30%",
    tvl: "$1,880",
    apr: "—",
    state: "paused",
    stateLabel: "Hedge too thin",
    price: 3.42,
    lower: 3.21,
    upper: 3.63,
    feedAge: "1m",
    hedge: "$47K/24h",
    hedged: false,
    fees24h: "+$4",
    il: "−$1",
    share: "$1.0002",
    supply: "1,880",
    cap: "hedge depth",
    epoch: 412
  }, {
    id: "mstr",
    ticker: "MSTR",
    pool: "MSTR / USDG · v3 0.30%",
    tvl: "$25,100",
    apr: "10.3%",
    state: "paused",
    stateLabel: "No Lighter perp",
    price: 318.60,
    lower: 299.48,
    upper: 337.72,
    feedAge: "44s",
    hedge: "none",
    hedged: false,
    fees24h: "+$71",
    il: "−$22",
    share: "$1.0119",
    supply: "24,800",
    cap: "unhedged only",
    epoch: 412
  }],
  positions: [{
    id: "intc-x",
    ticker: "INTC",
    hedged: false,
    balance: "11,904.12",
    value: "$12,394",
    pnl: "+$214",
    pnlTone: "positive"
  }, {
    id: "intc-h",
    ticker: "INTC",
    hedged: true,
    balance: "4,000.00",
    value: "$4,061",
    pnl: "−$18",
    pnlTone: "negative"
  }, {
    id: "meta-x",
    ticker: "META",
    hedged: false,
    balance: "2,480.00",
    value: "$2,502",
    pnl: "+$22",
    pnlTone: "positive"
  }],
  queue: [{
    id: "q1",
    slot: "412 · slot 7",
    shares: "1,200.00 hINTC",
    requested: "2026-09-16 14:02",
    status: "Queued",
    state: "pending"
  }, {
    id: "q2",
    slot: "411 · slot 3",
    shares: "800.00 hINTC",
    requested: "2026-09-15 19:41",
    status: "Claimable",
    state: "live"
  }],
  log: [{
    id: "l1",
    at: "14:02:11",
    what: "Range recentred",
    why: "Feed drifted 3.1% from range centre",
    tx: "0x8a4c…12f9"
  }, {
    id: "l2",
    at: "13:44:02",
    what: "Fees collected",
    why: "Auto-compound on; $1,142 returned to the range",
    tx: "0x71bd…0ce1"
  }, {
    id: "l3",
    at: "09:15:00",
    what: "Liquidity pulled",
    why: "15 min before US open — gap risk",
    tx: "0x4fe2…9a77"
  }, {
    id: "l4",
    at: "08:59:40",
    what: "Hedge reduced 12%",
    why: "Delta band breach after overnight drift",
    tx: "0x2b19…d40a"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.EpochTimer = __ds_scope.EpochTimer;

__ds_ns.KeyValue = __ds_scope.KeyValue;

__ds_ns.RangeMeter = __ds_scope.RangeMeter;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.TokenMark = __ds_scope.TokenMark;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.AmountInput = __ds_scope.AmountInput;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TopNav = __ds_scope.TopNav;

})();
