export interface StatProps {
  /** Mono uppercase caption, e.g. "TVL", "TRAILING 24H FEE APR". */
  label: string;
  value: string | number;
  /** Trailing unit shown small and muted: "%", "USDG". */
  unit?: string;
  /** Signed change, e.g. "+0.8%". Sign infers tone unless deltaTone is set. */
  delta?: string;
  deltaTone?: "positive" | "negative";
  /** One short qualifier line below, e.g. "trailing 24h, decays". */
  hint?: string;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  style?: React.CSSProperties;
}
export function Stat(props: StatProps): JSX.Element;
