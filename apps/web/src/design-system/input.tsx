import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement> | undefined;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leading,
  trailing,
  id,
  className = '',
  'aria-describedby': describedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  return (
    <div className={`field ${className}`} data-error={Boolean(error)}>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field-control" data-disabled={props.disabled || undefined}>
        {leading && (
          <span className="field-leading" aria-hidden="true">
            {leading}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            [describedBy, (error || hint) && messageId].filter(Boolean).join(' ') || undefined
          }
        />
        {trailing && <span className="field-trailing">{trailing}</span>}
      </div>
      {(error || hint) && (
        <p
          id={messageId}
          className={error ? 'field-error' : 'field-hint'}
          role={error ? 'alert' : undefined}
        >
          {error && <WarningCircle size={15} aria-hidden="true" />}
          {error || hint}
        </p>
      )}
    </div>
  );
}
