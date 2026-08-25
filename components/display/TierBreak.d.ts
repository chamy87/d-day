/** Horizontal tier separator for ranked lists — colored TIER N label + fading rule. Tiers 1–6, hot→cold. */
export interface TierBreakProps {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  /** Right-aligned note, e.g. "3 left" */
  note?: string;
}
export declare function TierBreak(props: TierBreakProps): JSX.Element;
