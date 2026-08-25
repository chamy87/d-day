/**
 * Primary action button. Amber primary = the one main action per view ("Enter league", "Draft player").
 * @startingPoint section="Core" subtitle="Buttons — primary, secondary, ghost, danger" viewport="700x180"
 */
export interface ButtonProps {
  /** Visual style */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Optional leading icon node (Lucide SVG) */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
