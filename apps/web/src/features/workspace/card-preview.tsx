import { ContactlessPayment, SimCard } from '@phosphor-icons/react';
export function CardPreview() {
  return (
    <div
      className="card-preview"
      role="img"
      aria-label="Graphite Flux card design preview. This is not an issued payment card."
    >
      <div className="card-preview-top">
        <span className="card-wordmark">Flux.</span>
        <span>Preview</span>
      </div>
      <div className="card-preview-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="card-preview-bottom">
        <span className="card-chip">
          <SimCard size={27} weight="thin" />
          <ContactlessPayment size={20} />
        </span>
        <span className="card-network">
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
