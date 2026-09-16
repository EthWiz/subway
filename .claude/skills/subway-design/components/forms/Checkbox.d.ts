export interface CheckboxProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
