export interface CardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Right-aligned header slot — usually a Button or IconButton. */
  actions?: React.ReactNode;
  /** sunken for nested read-only blocks; accent for the one "floor NAV" style notice; inverse for marketing. */
  tone?: "default" | "sunken" | "inverse" | "accent";
  pad?: "none" | "sm" | "md" | "lg";
  /** Adds hover lift + pointer; use for whole-card links such as a vault row. */
  interactive?: boolean;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
