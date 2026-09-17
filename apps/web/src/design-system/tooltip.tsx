import * as Primitive from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
export const TooltipProvider = Primitive.Provider;
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className="tooltip" sideOffset={8}>
          {content}
          <Primitive.Arrow className="tooltip-arrow" />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
