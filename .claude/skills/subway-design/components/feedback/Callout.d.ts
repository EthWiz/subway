export interface CalloutProps {
  children?: React.ReactNode;
  title?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "positive";
  /** Overrides the tone's default Lucide glyph. */
  icon?: string;
  /** Button slot under the body. */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Callout(props: CalloutProps): JSX.Element;
