export interface TagProps {
  children?: React.ReactNode;
  /** Selected tags invert to ink. */
  selected?: boolean;
  onClick?: () => void;
  /** When present, renders an × affordance. */
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export function Tag(props: TagProps): JSX.Element;
