export interface TabItem { value: string; label: string; count?: number }
export interface TabsProps {
  value?: string;
  onChange?: (value: string) => void;
  tabs?: (string | TabItem)[];
  style?: React.CSSProperties;
}
export function Tabs(props: TabsProps): JSX.Element;
