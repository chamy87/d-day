/** Mono ▲/▼ delta readout — value-vs-ADP, projection swings. Positive = green ▲, negative = red ▼, zero = dot. */
export interface StatDeltaProps {
  /** Signed number; sign picks glyph and color */
  value: number;
  /** Unit suffix, e.g. " vs ADP" or "%" */
  suffix?: string;
  /** Muted trailing label */
  label?: string;
}
export declare function StatDelta(props: StatDeltaProps): JSX.Element;
