/** Square icon-only button for toolbars and row actions. Requires an accessible label. */
export interface IconButtonProps {
  /** Accessible name (aria-label + title) */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  /** Toggled/selected state (amber tint) */
  active?: boolean;
  disabled?: boolean;
  /** The icon SVG */
  children?: React.ReactNode;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
