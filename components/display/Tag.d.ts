/** Pill tag for statuses: value/reach flags, injury designations (Q/OUT), bye weeks, "degraded" notices. */
export interface TagProps {
  tone?: 'neutral' | 'value' | 'reach' | 'accent' | 'warn';
  children?: React.ReactNode;
}
export declare function Tag(props: TagProps): JSX.Element;
