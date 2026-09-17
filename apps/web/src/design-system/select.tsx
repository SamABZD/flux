import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { CaretDown } from '@phosphor-icons/react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}
export function Select({
  label,
  id,
  children,
  error,
  hint,
  className = '',
  'aria-describedby': describedBy,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={`field ${className}`} data-error={Boolean(error)}>
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <div className="field-control select-control" data-disabled={props.disabled || undefined}>
        <select
          {...props}
          id={selectId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            [describedBy, (error || hint) && `${selectId}-message`].filter(Boolean).join(' ') ||
            undefined
          }
        >
          {children}
        </select>
        <CaretDown size={16} aria-hidden="true" />
      </div>
      {(error || hint) && (
        <p id={`${selectId}-message`} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
