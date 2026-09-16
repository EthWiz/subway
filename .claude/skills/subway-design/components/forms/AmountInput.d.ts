export interface AmountInputProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Ticker chip on the right: "USDG", "xNVDA". */
  asset?: string;
  /** Formatted wallet balance shown top-right. */
  balance?: string;
  /** Feed-priced equivalent under the figure, e.g. "≈ $4,120 at feed". */
  usdValue?: string;
  label?: string;
  /** Sets the MAX affordance next to the balance. */
  onMax?: () => void;
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function AmountInput(props: AmountInputProps): JSX.Element;
