export interface RangeMeterProps {
  /** Numeric range bounds used to place the price marker. */
  lower: number;
  upper: number;
  /** Current Chainlink feed price — never the pool tick. */
  price: number;
  lowerLabel?: string;
  upperLabel?: string;
  /** Centre caption, e.g. "$121.40 feed". */
  priceLabel?: string;
  /** Out of range switches the band from positive green to warning amber. */
  inRange?: boolean;
  height?: number;
  style?: React.CSSProperties;
}
export function RangeMeter(props: RangeMeterProps): JSX.Element;
