import { useId } from 'react';
import * as Primitive from '@radix-ui/react-switch';

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}
export function Toggle({ label, description, checked, onCheckedChange, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="toggle-field">
      <div>
        <label htmlFor={id}>{label}</label>
        {description && <p id={`${id}-hint`}>{description}</p>}
      </div>
      <Primitive.Root
        className="toggle"
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-hint` : undefined}
      >
        <Primitive.Thumb className="toggle-thumb" />
      </Primitive.Root>
    </div>
  );
}
