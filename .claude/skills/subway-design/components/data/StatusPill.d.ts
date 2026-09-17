export interface StatusPillProps {
  /** live = in range / keeper healthy; pending = queued or awaiting epoch; paused = feed paused or deposits capped; halted = panic. */
  state?: "live" | "pending" | "paused" | "halted";
  /** Overrides the default word, e.g. "Feed stale 2h". */
  label?: string;
  /** Adds a soft halo — use only for the one thing currently changing. */
  pulse?: boolean;
  style?: React.CSSProperties;
}
export function StatusPill(props: StatusPillProps): JSX.Element;
