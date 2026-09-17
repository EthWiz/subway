export interface SelectOption { value: string; label: string }
export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Plain strings or {value,label} pairs. */
  options?: (string | SelectOption)[];
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}
export function Select(props: SelectProps): JSX.Element;
