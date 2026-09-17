export interface TooltipProps {
  /** The trigger — gets a dotted underline. */
  children?: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom";
  style?: React.CSSProperties;
}
export function Tooltip(props: TooltipProps): JSX.Element;
