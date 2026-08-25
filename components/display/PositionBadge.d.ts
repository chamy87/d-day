/** Position identity chip (QB/RB/WR/TE/K/DEF/FLEX/SFLX/BN) in the fixed position palette. Mono, uppercase, tinted. */
export interface PositionBadgeProps {
  pos: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'SFLX' | 'BN';
  size?: 'sm' | 'md';
}
export declare function PositionBadge(props: PositionBadgeProps): JSX.Element;
