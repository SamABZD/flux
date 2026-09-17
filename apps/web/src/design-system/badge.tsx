import type { ReactNode } from 'react';
export type Tone = 'neutral' | 'success' | 'error' | 'warning' | 'info';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
