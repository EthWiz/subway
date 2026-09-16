export interface TopNavItem { value: string; label: string }
export interface TopNavProps {
  active?: string;
  onNavigate?: (value: string) => void;
  /** Defaults to Vaults / Portfolio / Research / Docs. */
  items?: TopNavItem[];
  /** Truncated address, e.g. "0x4f2a…9c1b". Omit to show the Connect button. */
  address?: string;
  chainLabel?: string;
  onConnect?: () => void;
  style?: React.CSSProperties;
}
export function TopNav(props: TopNavProps): JSX.Element;
