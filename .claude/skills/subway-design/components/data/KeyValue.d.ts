export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
  /** Colours the value; use sparingly — PnL and funding only. */
  tone?: "default" | "positive" | "negative" | "muted";
  /** Hover note on an info glyph next to the label. */
  note?: string;
}
export interface KeyValueProps {
  items?: KeyValueItem[];
  dense?: boolean;
  style?: React.CSSProperties;
}
export function KeyValue(props: KeyValueProps): JSX.Element;
