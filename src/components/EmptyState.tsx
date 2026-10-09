import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  symbol?: string;
}

export function EmptyState({ title, children, symbol = '↗' }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">{symbol}</span>
      <h2>{title}</h2>
      <div className="empty-description">{children}</div>
    </div>
  );
}
