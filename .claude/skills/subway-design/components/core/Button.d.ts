export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = the one committing action; inverse for marketing CTAs; danger for panic/exit paths. */
  variant?: "primary" | "secondary" | "inverse" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Lucide icon name rendered before the label. */
  icon?: string;
  /** Lucide icon name rendered after the label. */
  iconAfter?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;
