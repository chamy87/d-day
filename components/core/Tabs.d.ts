/** Segmented tab strip (uppercase). Position filters (ALL/QB/RB/WR/TE), dashboard sections. */
export interface TabsProps {
  /** Strings or {value,label} pairs */
  items: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
}
export declare function Tabs(props: TabsProps): JSX.Element;
