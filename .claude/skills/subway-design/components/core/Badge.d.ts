export interface BadgeProps {
  children?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "info" | "accent";
  /** Lucide icon name rendered at 11px before the label. */
  icon?: string;
  /** Mono uppercase with tracking (default) or sentence case. */
  uppercase?: boolean;
  style?: React.CSSProperties;
}
export function Badge(props: BadgeProps): JSX.Element;
