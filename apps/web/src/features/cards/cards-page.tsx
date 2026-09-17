import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Plus,
  LockSimple,
  LockSimpleOpen,
  Eye,
  GearSix,
  ArrowUpRight,
  ShieldCheck,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { ErrorState, EmptyState } from '@/design-system/feedback';
import { useToast } from '@/design-system/toast';
import { BalanceSkeleton } from '@/features/finance/loading';
import { formatDate } from '@/features/finance/format';
import { transferError } from '@/features/transfers/transfers-api';
import { useGetCardsQuery, usePatchCardMutation, useGetCardAuditQuery } from './cards-api';
import { CardArt } from './card-art';
import { CardHistory } from './card-history';
import { CardSettings, LimitEditor, CreateCard } from './card-editors';
import { SecureReveal } from './secure-reveal';
import type { Card } from './types';
import { cardMoney, cardTypeNames, cardStatusNames } from './types';
import './cards.css';

function CardAuditHistory({ cardId }: { cardId: string }) {
  const query = useGetCardAuditQuery(cardId);
  return (
    <div className="card-audit">
      {query.isError ? (
        <ErrorState title="Security activity unavailable" onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <BalanceSkeleton />
      ) : (
        <ul>
          {query.data.map((event) => (
            <li key={event.id}>
              <span>{event.action.toLowerCase().replaceAll('_', ' ')}</span>
              <time dateTime={event.createdAt}>{formatDate(event.createdAt, true)} UTC</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function SelectedCard({ card }: { card: Card }) {
  const [dialog, setDialog] = useState<'settings' | 'limit' | 'reveal' | null>(null);
  const [audit, setAudit] = useState(false);
  const [patch, { isLoading }] = usePatchCardMutation();
  const [error, setError] = useState('');
  const notify = useToast();
  const version = useRef(card.credentialVersion);
  const available = ['ACTIVE', 'FROZEN'].includes(card.status);
  useEffect(() => {
    if (card.credentialVersion > version.current)
      notify('Card details refreshed for your security');
    version.current = card.credentialVersion;
  }, [card.credentialVersion, notify]);
  const freeze = async () => {
    setError('');
    try {
      await patch({
        id: card.id,
        body: { status: card.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN' },
      }).unwrap();
      notify(
        card.status === 'FROZEN' ? 'Card unfrozen' : 'Card frozen',
        card.status === 'FROZEN'
          ? 'Your enabled payment methods are available again.'
          : 'New payments will be declined.',
      );
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  return (
    <>
      <div className="selected-card-heading">
        <div>
          <div className="card-label-line">
            <h2>{card.label}</h2>
            <Badge
              tone={
                card.status === 'ACTIVE'
                  ? 'success'
                  : card.status === 'FROZEN'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {cardStatusNames[card.status]}
            </Badge>
          </div>
          <p>
            {cardTypeNames[card.type]} · ending {card.last4}
          </p>
        </div>
        <div className="card-actions">
          <Button
            variant="secondary"
            loading={isLoading}
            disabled={!available}
            leadingIcon={
              card.status === 'FROZEN' ? <LockSimpleOpen size={18} /> : <LockSimple size={18} />
            }
            onClick={() => void freeze()}
          >
            {card.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
          </Button>
          <Button
            variant="secondary"
            disabled={!available}
            leadingIcon={<Eye size={18} />}
            onClick={() => setDialog('reveal')}
          >
            View details
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<GearSix size={19} />}
            onClick={() => setDialog('settings')}
          >
            Settings
          </Button>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {card.status === 'FROZEN' && (
        <p className="card-notice" role="status">
          <LockSimple size={18} aria-hidden="true" /> This card is frozen. New payments will be
          declined until you unfreeze it.
        </p>
      )}
      <div className="card-info-grid">
        <section className="card-limit-summary">
          <div className="card-summary-top">
            <h3>Monthly spending</h3>
            <Button variant="ghost" disabled={!available} onClick={() => setDialog('limit')}>
              {card.monthlyLimit.enabled ? 'Edit limit' : 'Set limit'}
            </Button>
          </div>
          <p className="card-spent">
            {cardMoney(card.monthlyLimit.spentMinor, 'USD')}{' '}
            <span>
              {card.monthlyLimit.enabled
                ? `of ${cardMoney(card.monthlyLimit.amountMinor ?? 0, 'USD')}`
                : 'this month'}
            </span>
          </p>
          {card.monthlyLimit.enabled && (
            <>
              <progress
                className="card-limit-progress"
                value={Math.min(card.monthlyLimit.spentMinor, card.monthlyLimit.amountMinor ?? 1)}
                max={card.monthlyLimit.amountMinor ?? 1}
                aria-label="Monthly spending limit usage"
              />
              <div className="card-limit-meta">
                <span>{cardMoney(card.monthlyLimit.remainingMinor ?? 0, 'USD')} remaining</span>
                <span>Resets {formatDate(card.monthlyLimit.periodEnd)}</span>
              </div>
            </>
          )}
          <p className="finance-caption">
            USD equivalent, including FX fees and ATM withdrawals.
            {!card.monthlyLimit.enabled && ' No monthly limit set.'}
          </p>
        </section>
        <section className="card-use-summary">
          <span className="card-feature-icon" aria-hidden="true">
            {card.type === 'SINGLE_USE' ? <ArrowClockwise size={25} /> : <ShieldCheck size={25} />}
          </span>
          <h3>
            {card.type === 'SINGLE_USE'
              ? 'A fresh start, every purchase.'
              : 'Your money, your controls.'}
          </h3>
          <p>
            {card.type === 'SINGLE_USE'
              ? 'Details refresh after each eligible online purchase. For subscriptions or wallet payments, choose a reusable card.'
              : card.type === 'VIRTUAL'
                ? 'Ready for online shopping and subscriptions. Manage online payments in settings.'
                : 'Keep the ways you pay switched on. Turn off the ones you don’t use in settings.'}
          </p>
          {card.type === 'SINGLE_USE' && card.credentialVersion > 1 && (
            <p className="card-rotation-note">
              Details refreshed · {formatDate(card.lastCredentialRotation, true)} UTC
            </p>
          )}
          <Link className="text-link" to="/accounts">
            Payments draw from your accounts <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <section className="card-history-section">
        <SectionHeader title="Card activity" description="Your latest 50 payments and attempts." />
        <CardHistory cardId={card.id} />
      </section>
      <details className="card-security-history" onToggle={(e) => setAudit(e.currentTarget.open)}>
        <summary>Security activity</summary>
        {audit && <CardAuditHistory cardId={card.id} />}
      </details>
      {dialog === 'settings' && <CardSettings card={card} onClose={() => setDialog(null)} />}
      {dialog === 'limit' && <LimitEditor card={card} onClose={() => setDialog(null)} />}
      {dialog === 'reveal' && available && (
        <SecureReveal
          key={`${card.id}:${card.credentialVersion}`}
          card={card}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
export function CardsPage() {
  const { id } = useParams();
  const query = useGetCardsQuery(undefined, {
    refetchOnFocus: true,
  });
  const [create, setCreate] = useState(false);
  const cards = query.data;
  const active =
    cards?.filter((card) => card.status !== 'TERMINATED' && card.status !== 'EXPIRED') ?? [];
  const selected = id
    ? cards?.find((card) => card.id === id)
    : (active.find((card) => card.type === 'PHYSICAL') ?? active[0]);
  const inactive =
    cards?.filter((card) => card.status === 'TERMINATED' || card.status === 'EXPIRED') ?? [];
  return (
    <>
      <PageHeader
        title="Cards"
        description="Made for the way you pay."
        actions={
          <Button
            leadingIcon={<Plus size={18} />}
            onClick={() => setCreate(true)}
            disabled={!cards}
          >
            Add virtual card
          </Button>
        }
      />
      {query.isError ? (
        <ErrorState title="Cards couldn’t load" onRetry={() => void query.refetch()} />
      ) : !cards ? (
        <BalanceSkeleton />
      ) : (
        <>
          {active.length > 0 && (
            <nav className="card-selector" aria-label="Choose a card">
              {active.map((card) => (
                <Link
                  key={card.id}
                  to={`/cards/${card.id}`}
                  aria-current={card.id === selected?.id ? 'true' : undefined}
                  className="card-selector-item"
                  onFocus={(e) =>
                    e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                  }
                >
                  <CardArt card={card} />
                  <span className="card-selector-label">
                    <strong>{card.label}</strong>
                    <span>{cardTypeNames[card.type]}</span>
                  </span>
                </Link>
              ))}
            </nav>
          )}
          {selected ? (
            <SelectedCard key={selected.id} card={selected} />
          ) : id ? (
            <ErrorState title="Card not found" description="Choose a card from your workspace." />
          ) : (
            <EmptyState
              icon={<Plus size={28} />}
              title="Your next card starts here"
              description="Add a virtual card for online purchases."
            />
          )}
          {inactive.length > 0 && (
            <details className="card-security-history">
              <summary>Closed & expired cards ({inactive.length})</summary>
              <ul className="card-inactive-list">
                {inactive.map((card) => (
                  <li key={card.id}>
                    <Link className="text-link" to={`/cards/${card.id}`}>
                      {card.label} · ending {card.last4} · {cardStatusNames[card.status]}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="card-demo-footer">
            <p>Synthetic demo cards. No real payment network is connected.</p>
            <Link className="text-link" to="/demo/card-payments">
              Demo Tools <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {create && <CreateCard cards={cards} onClose={() => setCreate(false)} />}
        </>
      )}
    </>
  );
}
