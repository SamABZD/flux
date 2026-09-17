import { Skeleton } from '@/design-system/feedback';
export function TransactionSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading transactions" className="transaction-loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="transaction-skeleton-row" key={index}>
          <Skeleton width="44px" height="44px" />
          <div>
            <Skeleton width="45%" height="1rem" />
            <Skeleton width="70%" height="0.75rem" />
          </div>
          <Skeleton width="88px" height="1rem" />
        </div>
      ))}
    </div>
  );
}
export function BalanceSkeleton() {
  return (
    <div className="finance-balance-skeleton" role="status" aria-label="Loading balance">
      <Skeleton width="35%" />
      <Skeleton width="75%" height="3rem" />
      <Skeleton width="55%" />
    </div>
  );
}
export function AccountSkeleton() {
  return (
    <div className="account-grid" role="status" aria-label="Loading accounts">
      {[0, 1, 2, 3].map((index) => (
        <div className="account-tile" key={index}>
          <Skeleton width="25%" />
          <Skeleton width="75%" height="2rem" />
          <Skeleton width="55%" />
        </div>
      ))}
    </div>
  );
}
