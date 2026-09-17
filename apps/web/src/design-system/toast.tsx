import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import * as Primitive from '@radix-ui/react-toast';
import { CheckCircle, X } from '@phosphor-icons/react';
import { IconButton } from './button';

interface ToastMessage {
  id: number;
  title: string;
  description?: string | undefined;
}
const ToastContext = createContext<((title: string, description?: string) => void) | null>(null);
let nextId = 0;

export function Toast({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  return (
    <Primitive.Root
      className="toast"
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <CheckCircle className="toast-icon" size={22} aria-hidden="true" />
      <div>
        <Primitive.Title className="toast-title">{message.title}</Primitive.Title>
        {message.description && (
          <Primitive.Description className="toast-description">
            {message.description}
          </Primitive.Description>
        )}
      </div>
      <Primitive.Close asChild>
        <IconButton label="Dismiss notification">
          <X size={16} />
        </IconButton>
      </Primitive.Close>
    </Primitive.Root>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const notify = useCallback(
    (title: string, description?: string) =>
      setMessages((current) => [...current.slice(-2), { id: ++nextId, title, description }]),
    [],
  );
  return (
    <ToastContext.Provider value={notify}>
      <Primitive.Provider duration={6000} swipeDirection="right">
        {children}
        {messages.map((message) => (
          <Toast
            key={message.id}
            message={message}
            onDismiss={() =>
              setMessages((current) => current.filter((item) => item.id !== message.id))
            }
          />
        ))}
        <Primitive.Viewport className="toast-viewport" label="Notifications ({hotkey})" />
      </Primitive.Provider>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast requires ToastProvider.');
  return notify;
}
