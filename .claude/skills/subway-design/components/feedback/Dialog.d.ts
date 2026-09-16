export interface DialogProps {
  open?: boolean;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Right-aligned action row. */
  footer?: React.ReactNode;
  /** Omit to make the dialog non-dismissable (jurisdiction gate). */
  onClose?: () => void;
  width?: number;
  style?: React.CSSProperties;
}
export function Dialog(props: DialogProps): JSX.Element | null;
