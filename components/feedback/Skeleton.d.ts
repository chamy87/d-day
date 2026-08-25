/** Shimmer placeholder (uses .dday-skeleton keyframes from tokens/effects.css). Every loading state uses these, never spinners. */
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** Pill shape */
  round?: boolean;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
