import { ContactlessPayment, LockSimple, SimCard } from '@phosphor-icons/react';
import type { Card } from '@/features/cards/types';
import { cardStatusNames, cardTypeNames, expiry } from '@/features/cards/types';

export function DashboardCard({ card }: { card: Card }) {
  return (
    <div
      className={`dashboard-card dashboard-card--${card.type.toLowerCase()} ${card.status === 'FROZEN' ? 'dashboard-card--frozen' : ''}`}
      role="img"
      aria-label={`${card.label}, ${cardTypeNames[card.type]} demo card, ${cardStatusNames[card.status]}, ending ${card.last4}. Expires ${expiry(card)}.`}
    >
      <div className="dashboard-card-top">
        <span className="card-wordmark">Flux.</span>
        <span>
          {card.status === 'FROZEN' && <LockSimple size={14} aria-hidden="true" />}
          {cardStatusNames[card.status]}
        </span>
      </div>
      <div className="dashboard-card-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="dashboard-card-middle" aria-hidden="true">
        <span className="card-chip">
          <SimCard size={27} weight="thin" />
          {card.type === 'PHYSICAL' && <ContactlessPayment size={20} />}
        </span>
      </div>
      <div className="dashboard-card-number" aria-hidden="true">
        •••• •••• •••• {card.last4}
      </div>
      <div className="dashboard-card-bottom" aria-hidden="true">
        <span className="dashboard-card-holder">{card.holderName.toUpperCase()}</span>
        <span>
          VALID THRU
          <strong>{expiry(card)}</strong>
        </span>
        <span className="card-network">
          FLUX
          <strong>DEMO</strong>
        </span>
      </div>
    </div>
  );
}
