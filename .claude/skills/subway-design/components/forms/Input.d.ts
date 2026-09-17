export interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Mono uppercase caption above the field. */
  label?: string;
  /** Helper or error line below; turns negative when invalid. */
  hint?: string;
  prefix?: string;
  suffix?: string;
  /** Tabular mono figures — use for addresses, amounts, bps. */
  mono?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
