import { useRef } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { Input } from './input';
import type { InputProps } from './input';
import { IconButton } from './button';

interface SearchInputProps extends Omit<
  InputProps,
  'type' | 'value' | 'onChange' | 'leading' | 'trailing' | 'ref'
> {
  value: string;
  onValueChange: (value: string) => void;
}
export function SearchInput({ value, onValueChange, ...props }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Input
      {...props}
      ref={inputRef}
      type="search"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      leading={<MagnifyingGlass size={20} />}
      trailing={
        value ? (
          <IconButton
            label="Clear search"
            disabled={props.disabled || props.readOnly}
            onClick={() => {
              onValueChange('');
              inputRef.current?.focus();
            }}
          >
            <X size={16} />
          </IconButton>
        ) : undefined
      }
    />
  );
}
