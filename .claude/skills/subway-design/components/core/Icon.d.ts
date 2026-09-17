export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "arrow-up-right", "shield-check". */
  name: string;
  /** Rendered square size in px. Default 16. */
  size?: number;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
