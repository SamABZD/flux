import * as Primitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}
interface TabsProps {
  label: string;
  items: TabItem[];
  defaultValue: string;
}
export function Tabs({ label, items, defaultValue }: TabsProps) {
  return (
    <Primitive.Root defaultValue={defaultValue} className="tabs">
      <Primitive.List aria-label={label} className="tabs-list">
        {items.map((item) => (
          <Primitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="tabs-trigger"
          >
            {item.label}
          </Primitive.Trigger>
        ))}
      </Primitive.List>
      {items.map((item) => (
        <Primitive.Content key={item.value} value={item.value} className="tabs-content">
          {item.content}
        </Primitive.Content>
      ))}
    </Primitive.Root>
  );
}
