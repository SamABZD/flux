import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactElement } from 'react';
import { Button } from './button';

interface ConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  trigger: ReactElement;
}
export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  trigger,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-backdrop" />
        <AlertDialog.Content className="dialog confirmation-dialog">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description className="dialog-description">
            {description}
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm}>{confirmLabel}</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
