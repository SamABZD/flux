import { Link, Route, Routes, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { ErrorState } from '@/design-system/feedback';
import { BalanceSkeleton } from '@/features/finance/loading';
import { useGetTransferQuery, useGetTransferSessionQuery } from './transfers-api';
import { PaymentsPage } from './payments-page';
import { RecipientPicker } from './recipient-picker';
import { TransferFlow } from './transfer-flow';
import { TransferSummary } from './transfer-summary';
import './transfers.css';

function RecipientsPage() {
  const navigate = useNavigate();
  return (
    <>
      <Link className="text-link back-link" to="/payments">
        <ArrowLeft size={17} aria-hidden="true" /> Payments
      </Link>
      <PageHeader title="Recipients" description="The people and places you send to." />
      <div className="transfer-focused">
        <RecipientPicker
          selected=""
          onSelect={(recipient) => void navigate(`/payments/send?recipient=${recipient.id}`)}
        />
      </div>
    </>
  );
}
function TransferDetails() {
  const { id = '' } = useParams();
  const query = useGetTransferQuery(id, { refetchOnMountOrArgChange: true });
  return (
    <>
      <Link className="text-link back-link" to="/payments">
        <ArrowLeft size={17} aria-hidden="true" /> Payments
      </Link>
      <PageHeader
        title="Transfer details"
        description="Every detail, including the rate and fee."
      />
      <div className="transfer-focused">
        {query.isError ? (
          <ErrorState title="Transfer unavailable" onRetry={() => void query.refetch()} />
        ) : !query.data ? (
          <BalanceSkeleton />
        ) : (
          <>
            <TransferSummary transfer={query.data} />
            {query.data.failureReason && (
              <p className="transfer-failure-copy" role="status">
                {query.data.failureReason}
              </p>
            )}
            <div className="flow-actions">
              <Link
                className="button button--secondary"
                to={`/payments/${query.data.kind === 'exchange' ? 'exchange' : 'send'}?again=${query.data.id}${query.data.recipient ? `&recipient=${query.data.recipient.id}` : ''}`}
              >
                {query.data.kind === 'exchange' ? 'Exchange again' : 'Send again'}
              </Link>
              <Link className="text-link" to="/home">
                Back home
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
export function PaymentRoutes() {
  const session = useGetTransferSessionQuery(undefined, { refetchOnMountOrArgChange: true });
  if (session.isError)
    return (
      <>
        <PageHeader title="Payments" />
        <ErrorState
          title="Reconnect your demo session"
          description="Your saved transfer stays on this tab. Reconnect to continue safely."
          onRetry={() => void session.refetch()}
        />
      </>
    );
  if (!session.data)
    return (
      <>
        <PageHeader title="Payments" />
        <BalanceSkeleton />
      </>
    );
  return (
    <Routes>
      <Route index element={<PaymentsPage />} />
      <Route path="send" element={<TransferFlow key="send" kind="send" />} />
      <Route path="exchange" element={<TransferFlow key="exchange" kind="exchange" />} />
      <Route path="recipients" element={<RecipientsPage />} />
      <Route path="transfers/:id" element={<TransferDetails />} />
      <Route
        path="*"
        element={
          <>
            <PageHeader title="Payment page not found" />
            <Link to="/payments">Back to Payments</Link>
          </>
        }
      />
    </Routes>
  );
}
