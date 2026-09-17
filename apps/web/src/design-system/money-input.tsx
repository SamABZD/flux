import { Input } from './input';
import type { InputProps } from './input';
import { pastedMoney } from './money-text';

interface MoneyInputProps extends Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'leading' | 'inputMode'
> {
  value: string;
  currency: string;
  onValueChange: (value: string) => void;
}

export function MoneyInput({ currency, value, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      aria-label={props['aria-label'] ?? `${props.label} (${currency})`}
      type="text"
      inputMode="decimal"
      value={value}
      onPaste={(event) => {
        event.preventDefault();
        const next = pastedMoney(event.clipboardData.getData('text'));
        if (next !== null) onValueChange(next);
      }}
      leading={<span className="currency-code">{currency}</span>}
      onChange={(event) => {
        const next = event.target.value.replace(',', '.');
        if (/^\d{0,7}(\.\d{0,2})?$/.test(next)) onValueChange(next);
      }}
    />
  );
}
