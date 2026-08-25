/** Text input with uppercase micro-label and amber focus ring. `mono` for IDs and numbers. */
export interface InputProps {
  label?: string;
  /** Helper line under the field */
  hint?: string;
  /** Monospace value (league IDs, numbers) */
  mono?: boolean;
  size?: 'md' | 'lg';
  placeholder?: string;
  value?: string;
  onChange?: (e: any) => void;
}
export declare function Input(props: InputProps): JSX.Element;
