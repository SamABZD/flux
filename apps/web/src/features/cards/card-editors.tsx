import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ResponsiveDialog } from '@/design-system/modal';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { MoneyInput } from '@/design-system/money-input';
import { Toggle } from '@/design-system/toggle';
import { Select } from '@/design-system/select';
import { useToast } from '@/design-system/toast';
import { amountMinor } from '@/features/transfers/draft';
import { transferError } from '@/features/transfers/transfers-api';
import { useCreateCardMutation, usePatchCardMutation, useTerminateCardMutation } from './cards-api';
import type { Card, CardPatch, CardSecurity } from './types';
import { cardMoney } from './types';

export function LimitEditor({ card, onClose }: { card: Card; onClose: () => void }) {
  const [amount, setAmount] = useState(
    card.monthlyLimit.amountMinor === null ? '' : (card.monthlyLimit.amountMinor / 100).toFixed(2),
  );
  const [save, { isLoading }] = usePatchCardMutation();
  const [error, setError] = useState('');
  const notify = useToast();
  const update = async (value: number | null) => {
    setError('');
    try {
      await save({ id: card.id, body: { monthlyLimitMinor: value } }).unwrap();
      notify(value === null ? 'Spending limit removed' : 'Spending limit saved');
      onClose();
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title="Monthly spending limit"
      description="One limit for this card, across your currency accounts."
    >
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = amountMinor(amount);
          if (value !== null) void update(value);
        }}
      >
        <MoneyInput
          label="Monthly limit"
          currency="USD"
          value={amount}
          onValueChange={setAmount}
          disabled={isLoading}
          hint="Includes purchases, ATM withdrawals and any FX fees. Resets on the first of each month, UTC."
        />
        <p className="finance-caption">
          Spent this month: {cardMoney(card.monthlyLimit.spentMinor, 'USD')}. Foreign-currency
          spending counts at the rate used for each payment. Full refunds restore that payment’s
          allowance in its original month.
        </p>
        {amountMinor(amount) !== null && amountMinor(amount)! < card.monthlyLimit.spentMinor && (
          <p className="card-notice">
            This is below your current spending. New payments will be declined until allowance is
            available.
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading} disabled={amountMinor(amount) === null}>
            Save limit
          </Button>
        </div>
        {card.monthlyLimit.enabled && (
          <Button variant="ghost" disabled={isLoading} onClick={() => void update(null)}>
            Remove limit
          </Button>
        )}
      </form>
    </ResponsiveDialog>
  );
}
export const securityControls: { key: keyof CardSecurity; label: string; description: string }[] = [
  {
    key: 'onlinePayments',
    label: 'Online payments',
    description: 'Allow online purchases and recurring charges supported by this card.',
  },
  {
    key: 'contactlessPayments',
    label: 'Contactless payments',
    description: 'Tap the physical card to pay. Demo wallet payments have separate enrollment.',
  },
  {
    key: 'atmWithdrawals',
    label: 'ATM withdrawals',
    description: 'Allow cash withdrawals from your accounts. Your monthly card limit applies.',
  },
  {
    key: 'magstripePayments',
    label: 'Magnetic stripe',
    description: 'Allow payments that swipe the stripe on your physical card.',
  },
  {
    key: 'locationSecurity',
    label: 'Location security',
    description:
      'For simulated in-person payments, both country codes must match. No real location is requested.',
  },
];
export function CardSettings({ card, onClose }: { card: Card; onClose: () => void }) {
  const [label, setLabel] = useState(card.label);
  const [error, setError] = useState('');
  const [save, { isLoading }] = usePatchCardMutation();
  const [terminate, setTerminate] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [end, { isLoading: ending }] = useTerminateCardMutation();
  const notify = useToast();
  const available = card.status === 'ACTIVE' || card.status === 'FROZEN';
  const patch = async (body: CardPatch) => {
    setError('');
    try {
      await save({ id: card.id, body }).unwrap();
      notify(body.label ? 'Card label saved' : 'Security setting saved');
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  const destroy = async () => {
    setError('');
    try {
      await end(card.id).unwrap();
      notify('Virtual card terminated', 'Payment history and refunds remain available.');
      onClose();
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading && !ending) onClose();
      }}
      title={terminate ? 'Terminate this card?' : 'Card settings'}
      description={
        terminate
          ? `${card.label} · ending ${card.last4}`
          : 'Changes apply to this card as soon as they are saved.'
      }
    >
      {terminate ? (
        <div className="card-form">
          <p>
            This cannot be undone. This card will stop working and leave your active cards. Its
            payment history remains available, and refunds can still reach your account.
          </p>
          <Input
            label="Type TERMINATE to confirm"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={ending}
          />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setTerminate(false)} disabled={ending}>
              Keep card
            </Button>
            <Button
              variant="danger"
              loading={ending}
              disabled={confirmation !== 'TERMINATE'}
              onClick={() => void destroy()}
            >
              Terminate card
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form
            className="card-label-form"
            onSubmit={(e) => {
              e.preventDefault();
              void patch({ label: label.trim() });
            }}
          >
            <Input
              label="Card label"
              value={label}
              maxLength={32}
              onChange={(e) => setLabel(e.target.value)}
              disabled={!available || isLoading}
            />
            <Button
              type="submit"
              variant="secondary"
              loading={isLoading}
              disabled={!available || label.trim().length < 2 || label.trim() === card.label}
            >
              Save label
            </Button>
          </form>
          <div className="card-security-controls">
            {securityControls
              .filter((control) => card.type === 'PHYSICAL' || control.key === 'onlinePayments')
              .map((control) => (
                <Toggle
                  key={control.key}
                  label={control.label}
                  description={control.description}
                  checked={card.security[control.key] ?? false}
                  disabled={!available || isLoading}
                  onCheckedChange={(checked) => void patch({ [control.key]: checked })}
                />
              ))}
          </div>
          {card.type === 'SINGLE_USE' && (
            <p className="card-notice">
              One-time online purchases only. Recurring charges, subscriptions, ATM, physical
              payments and wallet enrollment are unavailable.
            </p>
          )}
          {card.type !== 'PHYSICAL' && card.status !== 'TERMINATED' && (
            <div className="card-termination">
              <h3>Close this virtual card</h3>
              <p className="finance-caption">
                Permanent closure. Your history and refunds are preserved.
              </p>
              <Button variant="danger" disabled={isLoading} onClick={() => setTerminate(true)}>
                Terminate card
              </Button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </ResponsiveDialog>
  );
}
export function CreateCard({ cards, onClose }: { cards: Card[]; onClose: () => void }) {
  const [type, setType] = useState<'VIRTUAL' | 'SINGLE_USE'>('VIRTUAL');
  const [label, setLabel] = useState('');
  const [create, { isLoading }] = useCreateCardMutation();
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const navigate = useNavigate();
  const notify = useToast();
  const existing = cards.find(
    (card) => card.type === 'SINGLE_USE' && ['ACTIVE', 'FROZEN', 'PENDING'].includes(card.status),
  );
  const submit = async () => {
    setError('');
    try {
      const card = await create({ type, label: label.trim() }).unwrap();
      notify('Virtual card ready', 'Synthetic demo card created.');
      onClose();
      void navigate(`/cards/${card.id}`);
    } catch (err) {
      const issue = transferError(err);
      setError(issue.message);
      setUncertain(issue.ambiguous);
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title="Add a virtual card"
      description="A new way to pay from your existing Flux accounts."
    >
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Select
          label="Card type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          disabled={isLoading || uncertain}
        >
          <option value="VIRTUAL">Reusable virtual</option>
          <option value="SINGLE_USE">Single-use virtual</option>
        </Select>
        <p>
          {type === 'VIRTUAL'
            ? 'Keep the same details for online shopping and subscriptions. Add it to a simulated digital wallet in Demo Tools.'
            : 'Card details refresh after eligible one-time online purchases. Use a reusable virtual card for subscriptions.'}
        </p>
        {type === 'SINGLE_USE' && existing ? (
          <div className="card-notice">
            <p>You already have a single-use card: {existing.label}.</p>
            <Link to={`/cards/${existing.id}`} className="text-link" onClick={onClose}>
              Open your single-use card
            </Link>
          </div>
        ) : (
          <>
            <Input
              label="Card label"
              placeholder={type === 'VIRTUAL' ? 'e.g. Subscriptions' : 'e.g. One-time purchases'}
              maxLength={32}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isLoading || uncertain}
            />
            <p className="finance-caption">
              This creates synthetic demo details. No real payment card is issued.
            </p>
            <Button
              type="submit"
              loading={isLoading}
              disabled={label.trim().length < 2 || uncertain}
            >
              Create virtual card
            </Button>
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p role="status">
            The response was interrupted. Close this dialog and check your card list before creating
            another card.
          </p>
        )}
      </form>
    </ResponsiveDialog>
  );
}
