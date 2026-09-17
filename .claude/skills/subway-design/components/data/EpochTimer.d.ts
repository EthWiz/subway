export interface EpochTimerProps {
  /** Epoch id, e.g. 412. */
  epoch: string | number;
  /** Formatted time to settlement, e.g. "04:12:08". */
  countdown: string;
  /** 0–100 progress through the epoch. */
  progress?: number;
  /** Honest wait copy, e.g. "Settles daily at 21:00 ET. Lighter withdrawals take minutes, up to 14 days in the escape-hatch case." */
  note?: string;
  style?: React.CSSProperties;
}
export function EpochTimer(props: EpochTimerProps): JSX.Element;
