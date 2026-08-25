/** Native select styled to system; ▼ glyph caret. For scoring format, position filters, week pickers. */
export interface SelectProps {
  label?: string;
  /** Strings or {value,label} pairs */
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (e: any) => void;
  size?: 'md' | 'lg';
}
export declare function Select(props: SelectProps): JSX.Element;
