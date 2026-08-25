/** The draft board's atomic row: rank, position chip, name + team/bye, VBD, ADP delta, injury tag. `drafted` strikes it out. */
export interface PlayerRowProps {
  rank?: number;
  name: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX';
  team?: string;
  /** Bye week number */
  bye?: number;
  /** League-tuned VBD points */
  vbd?: number;
  /** Value-vs-ADP delta (positive = value) */
  adpDelta?: number;
  /** Injury designation text, e.g. "Q" or "OUT" */
  injury?: string;
  /** Drafted — struck through, faded */
  drafted?: boolean;
  onClick?: () => void;
  /** Extra trailing node (e.g. queue button) */
  trailing?: React.ReactNode;
}
export declare function PlayerRow(props: PlayerRowProps): JSX.Element;
