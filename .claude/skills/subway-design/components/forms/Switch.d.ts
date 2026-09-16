export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  /** One-line consequence of turning it on. */
  description?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Switch(props: SwitchProps): JSX.Element;
