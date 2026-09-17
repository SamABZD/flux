import { useEffect, useRef, useState } from 'react';
import { Copy, LockKey } from '@phosphor-icons/react';
import { ResponsiveDialog } from '@/design-system/modal';
import { Input } from '@/design-system/input';
import { Button, IconButton } from '@/design-system/button';
import { useToast } from '@/design-system/toast';
import type { Card } from './types';
import { expiry } from './types';

interface RevealedDetails {
  number: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
  credentialVersion: number;
  synthetic: true;
  hideAfterSeconds: number;
}
export async function fetchCardDetails(
  id: string,
  pin: string,
  signal: AbortSignal,
): Promise<RevealedDetails> {
  const headers = { 'Content-Type': 'application/json', 'X-Flux-Client': 'web' };
  const send = () =>
    fetch(`${__API_BASE_URL__}/cards/${encodeURIComponent(id)}/reveal`, {
      method: 'POST',
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal,
      body: JSON.stringify({ pin }),
    });
  let response = await send();
  if (response.status === 401) {
    const session = await fetch(`${__API_BASE_URL__}/session/demo`, {
      method: 'POST',
      headers,
      credentials: 'include',
      signal,
    });
    if (session.ok) response = await send();
  }
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? 'That demo PIN didn’t match. Try 4821.'
        : 'Details could not be revealed. Check the card and try again.',
    );
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    !data ||
    !('synthetic' in data) ||
    data.synthetic !== true ||
    !('number' in data) ||
    typeof data.number !== 'string' ||
    !/^0000\d{12}$/.test(data.number) ||
    !('cvv' in data) ||
    typeof data.cvv !== 'string' ||
    !/^\d{3}$/.test(data.cvv) ||
    !('credentialVersion' in data) ||
    typeof data.credentialVersion !== 'number' ||
    !('expiryMonth' in data) ||
    typeof data.expiryMonth !== 'number' ||
    !('expiryYear' in data) ||
    typeof data.expiryYear !== 'number'
  )
    throw new Error('Details could not be revealed. Try again.');
  return data as RevealedDetails;
}
export function SecureReveal({ card, onClose }: { card: Card; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [details, setDetails] = useState<RevealedDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useToast();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const hide = () => {
      abort.current?.abort();
      setDetails(null);
      setPin('');
      closeRef.current();
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible') hide();
    };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const reveal = async () => {
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await fetchCardDetails(card.id, pin, controller.signal);
      if (controller.signal.aborted) return;
      if (result.credentialVersion !== card.credentialVersion) {
        setError('These details have refreshed. Close this view and try again.');
        return;
      }
      setPin('');
      setDetails(result);
      timer.current = setTimeout(() => {
        setDetails(null);
        closeRef.current();
        notify('Card details hidden');
      }, 30000);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Details unavailable.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify(`${label} copied`);
    } catch {
      setError(
        'Copy is unavailable in this browser. You can select the value while it is visible.',
      );
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Card details"
      description={`${card.label} · ending ${card.last4}`}
    >
      {details ? (
        <>
          <p className="card-secure-note">
            <LockKey size={18} aria-hidden="true" /> Hides after 30 seconds or when you leave this
            view.
          </p>
          <dl className="secure-card-values" data-sensitive>
            {(
              [
                ['Card number', details.number.replace(/(.{4})/g, '$1 ').trim(), details.number],
                ['Expiry', expiry(details), expiry(details)],
                ['CVV', details.cvv, details.cvv],
              ] as const
            ).map(([label, value, raw]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span>{value}</span>
                  <IconButton
                    label={`Copy ${label.toLowerCase()}`}
                    onClick={() => void copy(raw, label)}
                  >
                    <Copy size={19} />
                  </IconButton>
                </dd>
              </div>
            ))}
          </dl>
          <p className="finance-caption">
            Synthetic demo details. These cannot make real payments.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Hide details
          </Button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void reveal();
          }}
          className="card-form"
        >
          <div className="card-secure-intro">
            <LockKey size={28} aria-hidden="true" />
            <h3>Confirm it’s you</h3>
            <p>
              This portfolio uses a public demo PIN: <strong>4821</strong>. No real authentication
              or payment card is involved.
            </p>
          </div>
          <Input
            label="Demo PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            disabled={busy}
          />
          <Button type="submit" loading={busy} disabled={pin.length !== 4}>
            Reveal for 30 seconds
          </Button>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </ResponsiveDialog>
  );
}
