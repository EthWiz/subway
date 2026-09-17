export interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** false renders the cell in UI type instead of mono numerics. */
  mono?: boolean;
  wrap?: boolean;
  width?: string | number;
}
export interface DataTableProps {
  columns?: DataTableColumn[];
  /** Row objects keyed by column key; `id` is used as the React key. */
  rows?: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
  emptyLabel?: string;
  style?: React.CSSProperties;
}
export function DataTable(props: DataTableProps): JSX.Element;
