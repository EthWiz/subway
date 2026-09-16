export interface TokenMarkProps {
  /** Bare equity ticker, e.g. "NVDA" — the x/h prefix is added by the component. */
  ticker: string;
  /** Secondary line: issuer name or pool description. */
  name?: string;
  /** Hedged share (h…) renders the ink tile; unhedged (x…) renders the accent tile. */
  hedged?: boolean;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}
export function TokenMark(props: TokenMarkProps): JSX.Element;
