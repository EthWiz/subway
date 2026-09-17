export interface IconButtonProps {
  /** Lucide icon name. */
  name: string;
  /** Accessible label — required, becomes aria-label and title. */
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "outline";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function IconButton(props: IconButtonProps): JSX.Element;
