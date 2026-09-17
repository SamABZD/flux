import { ContactlessPayment, LockSimple, ArrowClockwise } from '@phosphor-icons/react';
import type { Card } from './types';
import { cardTypeNames, cardStatusNames, expiry } from './types';
export function CardArt({ card }: { card: Card }) {
  return (
    <div
      className={`flux-card flux-card--${card.type.toLowerCase()} ${card.status === 'FROZEN' ? 'flux-card--frozen' : ''}`}
      role="img"
      aria-label={`${cardTypeNames[card.type]} demo card, ${cardStatusNames[card.status]}, ending ${card.last4}. Expires ${expiry(card)}.`}
    >
      <div className="flux-card-top" aria-hidden="true">
        <span className="card-wordmark">Flux.</span>
        <span>
          {card.status === 'FROZEN' ? (
            <>
              <LockSimple size={14} /> Frozen
            </>
          ) : (
            cardTypeNames[card.type]
          )}
        </span>
      </div>
      <div className="flux-card-glyph" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="flux-card-middle" aria-hidden="true">
        {card.type === 'PHYSICAL' ? (
          <>
            <span className="flux-chip" />
            <ContactlessPayment size={21} />
          </>
        ) : card.type === 'SINGLE_USE' ? (
          <ArrowClockwise size={22} />
        ) : (
          <span className="flux-card-digital">Digital / reusable</span>
        )}
      </div>
      <div className="flux-card-number" aria-hidden="true">
        •••• •••• •••• {card.last4}
      </div>
      <div className="flux-card-bottom" aria-hidden="true">
        <span>{card.holderName.toUpperCase()}</span>
        <span>
          VALID THRU
          <br />
          {expiry(card)}
        </span>
        <span>
          FLUX
          <br />
          DEMO
        </span>
      </div>
    </div>
  );
}
