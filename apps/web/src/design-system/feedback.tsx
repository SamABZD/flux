import type { ReactNode, CSSProperties } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { Button } from './button';

export function Skeleton({
  width = '100%',
  height = '1rem',
  label,
}: {
  width?: string;
  height?: string;
  label?: string;
}) {
  const style: CSSProperties = { width, height };
  return (
    <span
      className="skeleton"
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
    >
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 3,
}: {
  headingLevel?: 2 | 3;
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <Heading>{title}</Heading>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again in a moment.',
  onRetry,
  headingLevel = 3,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="error-state" role="alert">
      <WarningCircle size={24} aria-hidden="true" />
      <div>
        <Heading>{title}</Heading>
        <p>{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
