import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import type { ReactNode, RefObject } from 'react';
import { useRef } from 'react';
import { IconButton } from './button';
import { useMobile } from './use-mobile';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function Overlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  returnFocusRef,
  sheet = false,
}: ModalProps & { sheet?: boolean }) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content
          ref={contentRef}
          className={`dialog ${sheet ? 'dialog--sheet' : ''}`}
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const input =
              contentRef.current?.querySelector<HTMLInputElement>('input:not([disabled])');
            if (input) {
              event.preventDefault();
              input.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current ?? previousFocus.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          {sheet && <div className="sheet-handle" aria-hidden="true" />}
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close dialog">
                <X size={20} />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="dialog-description">{description}</Dialog.Description>
          <div className="dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Modal(props: ModalProps) {
  return <Overlay {...props} />;
}
export function BottomSheet(props: ModalProps) {
  return <Overlay {...props} sheet />;
}
export function ResponsiveDialog(props: ModalProps) {
  const mobile = useMobile();
  return <Overlay {...props} sheet={mobile} />;
}
