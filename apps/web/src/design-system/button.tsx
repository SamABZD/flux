import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { CircleNotch } from '@phosphor-icons/react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement> | undefined;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button button--${variant} ${className}`}
    >
      {loading ? (
        <CircleNotch className="spinner" size={18} aria-hidden="true" />
      ) : (
        leadingIcon && (
          <span className="button-icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )
      )}
      {children != null && <span>{children}</span>}
      {!loading && trailingIcon && (
        <span className="button-icon" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leadingIcon' | 'trailingIcon'> {
  label: string;
  children: ReactNode;
}

export function IconButton({
  label,
  children,
  className = '',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Button {...props} variant={variant} aria-label={label} className={`icon-button ${className}`}>
      {props.loading ? null : <span aria-hidden="true">{children}</span>}
    </Button>
  );
}
