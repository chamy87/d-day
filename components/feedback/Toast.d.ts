/** Transient notice card (pick made, projections degraded). Status dot, not an icon. */
export interface ToastProps {
  tone?: 'neutral' | 'value' | 'reach' | 'accent';
  title?: string;
  children?: React.ReactNode;
}
export declare function Toast(props: ToastProps): JSX.Element;
