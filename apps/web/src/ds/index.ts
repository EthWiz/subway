/**
 * The Subway design system, vendored from `.claude/skills/subway-design`.
 *
 * Sources for each primitive are `components/<group>/<Name>.jsx` in that skill;
 * these are ports to TSX, using the prop types the skill ships as `<Name>.d.ts`.
 * Behaviour and styling are unchanged except where a note in the file says
 * otherwise (`Icon` and `TopNav` are adapted for Next).
 *
 * Tokens live in `src/ds/tokens/` and are copied verbatim — see globals.css.
 */
export { Icon, type IconProps } from "./core/Icon";
export { Badge, type BadgeProps } from "./core/Badge";
export { Button, type ButtonProps } from "./core/Button";
export { IconButton, type IconButtonProps } from "./core/IconButton";
export { Card, type CardProps } from "./core/Card";
export { Stat, type StatProps } from "./core/Stat";
export { Tag, type TagProps } from "./core/Tag";

export { AmountInput, type AmountInputProps } from "./forms/AmountInput";
export { Checkbox, type CheckboxProps } from "./forms/Checkbox";
export { Input, type InputProps } from "./forms/Input";
export { Select, type SelectProps } from "./forms/Select";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./forms/SegmentedControl";
export { Switch, type SwitchProps } from "./forms/Switch";

export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTableRow,
} from "./data/DataTable";
export { KeyValue, type KeyValueProps, type KeyValueItem } from "./data/KeyValue";
export { RangeMeter, type RangeMeterProps } from "./data/RangeMeter";
export { StatusPill, type StatusPillProps } from "./data/StatusPill";
export { TokenMark, type TokenMarkProps } from "./data/TokenMark";
export { EpochTimer, type EpochTimerProps } from "./data/EpochTimer";

export { Callout, type CalloutProps } from "./feedback/Callout";
export { Dialog, type DialogProps } from "./feedback/Dialog";
export { Tooltip, type TooltipProps } from "./feedback/Tooltip";

export { Tabs, type TabsProps, type TabItem } from "./navigation/Tabs";
export { TopNav, type TopNavProps, type TopNavItem } from "./navigation/TopNav";
