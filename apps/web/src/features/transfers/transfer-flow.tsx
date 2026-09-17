import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowsLeftRight } from '@phosphor-icons/react';
import { Button } from '@/design-system/button';
import { ErrorState } from '@/design-system/feedback';
import { useGetAccountsQuery } from '@/features/finance/finance-api';
import { BalanceSkeleton } from '@/features/finance/loading';
import { formatMoney } from '@/features/finance/format';
import {
  useCreateQuoteMutation,
  useGetQuoteQuery,
  useGetRecipientsQuery,
  useExecuteTransferMutation,
  useGetTransferQuery,
  useLazyGetTransferByKeyQuery,
  transferError,
  transfersApi,
} from './transfers-api';
import { useAppDispatch } from '@/app/hooks';
import { amountMinor, newDraft, readDraft, saveDraft } from './draft';
import type { TransferDraft } from './draft';
import type { TransferKind, TransferQuote } from './types';
import { RecipientPicker } from './recipient-picker';
import { AmountStep } from './amount-step';
import { ReviewStep } from './review-step';
import { TransferResult } from './transfer-result';

export function TransferFlow({ kind }: { kind: TransferKind }) {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<TransferDraft>(() => {
    const saved = readDraft();
    if (saved?.submission && saved.step !== 'result') return { ...saved, step: 'uncertain' };
    if (saved && saved.kind === kind && !params.has('again') && !params.has('recipient'))
      return saved;
    return newDraft(kind, params.get('recipient') ?? '');
  });
  const [error, setError] = useState('');
  const [freshQuote, setFreshQuote] = useState<TransferQuote | null>(null);
  useEffect(() => {
    if (!params.has('again') && !params.has('recipient')) return;
    try {
      saveDraft(draft);
      const next = new URLSearchParams(params);
      next.delete('again');
      next.delete('recipient');
      setParams(next, { replace: true });
    } catch {
      setError('Your draft couldn’t be saved. Free browser storage and try again.');
    }
  }, [draft, params, setParams]);
  const accounts = useGetAccountsQuery(undefined, { refetchOnMountOrArgChange: true });
  const recipients = useGetRecipientsQuery();
  const quoteQuery = useGetQuoteQuery(draft.quoteId, {
    skip: !draft.quoteId || draft.step !== 'review',
    refetchOnMountOrArgChange: true,
  });
  const result = useGetTransferQuery(draft.resultId, { skip: !draft.resultId });
  const [createQuote, quoting] = useCreateQuoteMutation();
  const [execute, executing] = useExecuteTransferMutation();
  const [lookup, looking] = useLazyGetTransferByKeyQuery();
  const dispatch = useAppDispatch();
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const recipient = recipients.data?.find((item) => item.id === draft.recipientId);
  const account = accounts.data?.items.find((item) => item.id === draft.sourceAccountId);
  const quote = freshQuote?.id === draft.quoteId ? freshQuote : quoteQuery.currentData;
  function commit(next: TransferDraft) {
    try {
      saveDraft(next);
      setDraft(next);
      return true;
    } catch {
      setError(
        'This tab couldn’t save your transfer draft. Free browser storage and try again before confirming.',
      );
      return false;
    }
  }
  function change(next: Partial<TransferDraft>) {
    revision.current++;
    setError('');
    setFreshQuote(null);
    commit({ ...draft, ...next, quoteId: '', submission: null, resultId: '' });
  }
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [draft.step]);
  useEffect(() => {
    if (
      draft.step === 'amount' &&
      draft.kind === 'send' &&
      recipient &&
      !recipient.supportedCurrencies.includes(draft.destinationCurrency)
    ) {
      const next = { ...draft, destinationCurrency: recipient.preferredCurrency };
      try {
        saveDraft(next);
        setDraft(next);
      } catch {
        setError('Your draft couldn’t be saved. Free browser storage and try again.');
      }
    }
  }, [recipient, draft]);
  async function getQuote() {
    const amount = amountMinor(draft.amount);
    if (!account || amount === null) return;
    setError('');
    const requestedRevision = revision.current;
    try {
      const data = await createQuote({
        kind: draft.kind,
        sourceAccountId: draft.sourceAccountId,
        sourceCurrency: account.currency,
        destinationCurrency: draft.destinationCurrency,
        destinationAmountMinor: amount,
        ...(draft.kind === 'send'
          ? { recipientId: draft.recipientId }
          : { destinationAccountId: draft.destinationAccountId }),
      }).unwrap();
      if (!mounted.current || revision.current !== requestedRevision) return;
      setFreshQuote(data);
      commit({ ...draft, quoteId: data.id, step: 'review', submission: null, resultId: '' });
    } catch (reason) {
      if (mounted.current && revision.current === requestedRevision)
        setError(transferError(reason).message);
    }
  }
  async function submit() {
    if (submitting.current) return;
    const submission = draft.submission ?? {
      key: crypto.randomUUID(),
      body: {
        quoteId: draft.quoteId,
        sourceAccountId: draft.sourceAccountId,
        ...(draft.kind === 'send'
          ? { recipientId: draft.recipientId }
          : { destinationAccountId: draft.destinationAccountId }),
        note: draft.note,
      },
    };
    if (!submission.body.quoteId) return;
    const pending = { ...draft, submission, step: 'processing' as const };

    if (!commit(pending)) return;
    submitting.current = true;
    setError('');
    try {
      const transfer = await execute(submission).unwrap();
      commit({ ...pending, step: 'result', resultId: transfer.id });
    } catch (reason) {
      const failure = transferError(reason);
      setError(
        failure.ambiguous
          ? 'We couldn’t confirm the result. The transfer may have completed. Check the result or retry safely; the same transfer won’t be sent twice.'
          : failure.shortfallMinor !== null && account
            ? `You need ${formatMoney(failure.shortfallMinor, account.currency)} more. Your balance changed. Reduce the amount or choose another account.`
            : failure.message,
      );
      commit({
        ...pending,
        step: failure.ambiguous ? 'uncertain' : 'review',
        submission: failure.ambiguous ? submission : null,
      });
      if (!failure.ambiguous) {
        setFreshQuote(null);
        dispatch(transfersApi.util.invalidateTags(['Accounts']));
      }
    } finally {
      submitting.current = false;
    }
  }
  async function checkResult() {
    if (!draft.submission) return;
    setError('');
    try {
      const data = await lookup(draft.submission.key, false).unwrap();
      if (data.transfer) {
        dispatch(
          transfersApi.util.invalidateTags([
            'Accounts',
            'Overview',
            'Transactions',
            'Transfers',
            'Recipients',
          ]),
        );
        commit({ ...draft, step: 'result', resultId: data.transfer.id });
      } else
        setError(
          'No completed result is available yet. Retry safely using the saved request. Any earlier attempt will be checked before another transfer can run.',
        );
    } catch {
      setError(
        'The connection is still unavailable. Your saved request is safe to retry when you reconnect.',
      );
    }
  }
  const title =
    draft.step === 'recipient'
      ? 'Who are you sending to?'
      : draft.step === 'amount'
        ? draft.kind === 'send'
          ? 'How much should they receive?'
          : 'Make room in another currency.'
        : draft.step === 'review'
          ? 'Review your transfer'
          : draft.step === 'processing'
            ? 'Your transfer is processing'
            : draft.step === 'uncertain'
              ? 'Let’s check your transfer'
              : result.data?.status === 'FAILED'
                ? 'Transfer failed'
                : 'Transfer complete';
  const step = draft.step === 'recipient' ? 1 : draft.step === 'amount' ? 2 : 3;
  return (
    <>
      <Link className="text-link back-link" to="/payments">
        <ArrowLeft size={17} aria-hidden="true" /> Payments
      </Link>
      <div className="transfer-focused">
        <div className="flow-header">
          <span>{draft.kind === 'send' ? 'Send money' : 'Exchange'} · Demo</span>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <p>
            {draft.step === 'recipient'
              ? 'Choose someone you know, or add a new recipient.'
              : draft.step === 'amount'
                ? 'Choose your account and set the amount to receive.'
                : 'Clear details. No hidden fees.'}
          </p>
        </div>
        {['recipient', 'amount', 'review'].includes(draft.step) && (
          <ol className="transfer-steps" aria-label="Transfer progress">
            {['Recipient', 'Amount', 'Review'].map((label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? 'step' : undefined}
                className={step > index ? 'is-reached' : ''}
              >
                <span>{index + 1}</span>
                {draft.kind === 'exchange' && index === 0 ? 'Your accounts' : label}
              </li>
            ))}
          </ol>
        )}
        <div className="transfer-step-content">
          {error && (
            <p className="transfer-failure-copy" role="alert">
              {error}
            </p>
          )}
          {draft.step === 'recipient' && (
            <RecipientPicker
              selected={draft.recipientId}
              onSelect={(selected) =>
                change({
                  recipientId: selected.id,
                  destinationCurrency: selected.preferredCurrency,
                  step: 'amount',
                })
              }
            />
          )}
          {draft.step === 'amount' &&
            (accounts.isError || recipients.isError ? (
              <ErrorState
                title="Transfer details couldn’t load"
                onRetry={() => {
                  void accounts.refetch();
                  void recipients.refetch();
                }}
              />
            ) : !accounts.data || !recipients.data ? (
              <BalanceSkeleton />
            ) : (
              <AmountStep
                draft={draft}
                accounts={accounts.data.items}
                recipient={recipient}
                onChange={change}
                onQuote={() => void getQuote()}
                busy={quoting.isLoading}
              />
            ))}
          {draft.step === 'review' &&
            (quoteQuery.isError && !freshQuote ? (
              <>
                <ErrorState
                  title="Quote unavailable"
                  description="Get a fresh quote to review this transfer."
                  onRetry={() => void getQuote()}
                />
                <Button variant="secondary" onClick={() => change({ step: 'amount' })}>
                  Change amount or account
                </Button>
              </>
            ) : !quote ? (
              <BalanceSkeleton />
            ) : (
              <ReviewStep
                quote={quote}
                recipient={recipient}
                account={account}
                destinationName={
                  accounts.data?.items.find((item) => item.id === draft.destinationAccountId)
                    ?.name ?? 'Your account'
                }
                note={draft.note}
                busy={executing.isLoading || quoting.isLoading}
                onConfirm={() => void submit()}
                onRefresh={() => void getQuote()}
                onEdit={() => change({ step: 'amount' })}
              />
            ))}
          {draft.step === 'processing' && (
            <div className="transfer-processing" role="status">
              <span className="transfer-processing-icon">
                <ArrowsLeftRight size={32} aria-hidden="true" />
              </span>
              <h2>Putting things in motion</h2>
              <p>
                {quote
                  ? formatMoney(quote.destinationAmountMinor, quote.destinationCurrency)
                  : draft.amount}{' '}
                {recipient ? `to ${recipient.name}` : 'between your accounts'}
              </p>
              <div className="transfer-progress-track" aria-hidden="true">
                <span />
              </div>
              <p>
                We’re confirming the transfer. You can return to Payments and check the result
                there.
              </p>
            </div>
          )}
          {draft.step === 'uncertain' && (
            <div className="transfer-recovery">
              <h2>Your confirmation is saved</h2>
              <p>
                The outcome may already be recorded. Checking or retrying uses your original
                confirmation and cannot send it twice.
              </p>
              <div className="flow-actions">
                <Button onClick={() => void checkResult()} loading={looking.isFetching}>
                  Check result
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void submit()}
                  loading={executing.isLoading}
                >
                  Retry safely
                </Button>
              </div>
            </div>
          )}
          {draft.step === 'result' &&
            (result.isError ? (
              <ErrorState
                title="Result couldn’t load"
                description="Your transfer reference is saved. Reload its details to see the confirmed outcome."
                onRetry={() => void result.refetch()}
              />
            ) : !result.data ? (
              <BalanceSkeleton />
            ) : (
              <TransferResult
                transfer={result.data}
                onAgain={() => {
                  setError('');
                  setFreshQuote(null);
                  commit({
                    ...newDraft(draft.kind, draft.recipientId),
                    sourceAccountId: draft.sourceAccountId,
                    destinationAccountId: draft.destinationAccountId,
                    destinationCurrency: draft.destinationCurrency,
                  });
                }}
              />
            ))}
        </div>
        <p className="finance-footnote">Fictional money. Real care with every detail.</p>
      </div>
    </>
  );
}
