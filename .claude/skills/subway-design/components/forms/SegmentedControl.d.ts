export interface SegmentedOption { value: string; label: string; sublabel?: string }
export interface SegmentedControlProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: (string | SegmentedOption)[];
  size?: "sm" | "md";
  fullWidth?: boolean;
  style?: React.CSSProperties;
}
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
