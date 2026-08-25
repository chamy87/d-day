/** Panel card: dark surface, 1px border, 14px radius. Uppercase micro-title header; `glow` = on-the-clock amber ring. */
export interface CardProps {
  /** Uppercase panel header (MY ROSTER, ON THE CLOCK) */
  title?: string;
  /** Right-aligned header node */
  action?: React.ReactNode;
  /** Body padding (off for lists/tables) */
  pad?: boolean;
  /** Amber glow ring — on-the-clock state */
  glow?: boolean;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
