import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Input } from './input';
import type { InputProps } from './input';
import { IconButton } from './button';

export function PasswordInput(props: Omit<InputProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <IconButton
          disabled={props.disabled}
          label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeSlash size={19} /> : <Eye size={19} />}
        </IconButton>
      }
    />
  );
}
