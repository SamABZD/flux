import type { Currency } from '@/features/finance/types';
import { currencies } from '@/features/finance/types';
import type { TransferKind, TransferRequest } from './types';

export type FlowStep = 'recipient' | 'amount' | 'review' | 'processing' | 'uncertain' | 'result';
export interface TransferDraft {
  version: 1;
  kind: TransferKind;
  step: FlowStep;
  recipientId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  destinationCurrency: Currency;
  amount: string;
  note: string;
  quoteId: string;
  submission: { key: string; body: TransferRequest } | null;
  resultId: string;
}
export const DRAFT_KEY = 'flux.transfer.draft.v1';
export function newDraft(kind: TransferKind, recipientId = ''): TransferDraft {
  return {
    version: 1,
    kind,
    step: kind === 'send' && !recipientId ? 'recipient' : 'amount',
    recipientId,
    sourceAccountId: 'usd',
    destinationAccountId: 'eur',
    destinationCurrency: 'EUR',
    amount: '',
    note: '',
    quoteId: '',
    submission: null,
    resultId: '',
  };
}
export function readDraft(): TransferDraft | null {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
    if (typeof data !== 'object' || !data || !('version' in data) || data.version !== 1)
      return null;
    if (
      !('kind' in data) ||
      (data.kind !== 'send' && data.kind !== 'exchange') ||
      !('step' in data) ||
      !['recipient', 'amount', 'review', 'processing', 'uncertain', 'result'].includes(
        String(data.step),
      )
    )
      return null;
    for (const key of [
      'recipientId',
      'sourceAccountId',
      'destinationAccountId',
      'amount',
      'note',
      'quoteId',
      'resultId',
    ])
      if (!(key in data) || typeof (data as Record<string, unknown>)[key] !== 'string') return null;
    if (
      !('destinationCurrency' in data) ||
      !currencies.some((currency) => currency === data.destinationCurrency)
    )
      return null;
    if (!('submission' in data)) return null;
    if (data.submission !== null) {
      const submission = data.submission;
      if (
        typeof submission !== 'object' ||
        !('key' in submission) ||
        typeof submission.key !== 'string' ||
        !('body' in submission) ||
        typeof submission.body !== 'object' ||
        !submission.body
      )
        return null;
      if (
        !('quoteId' in submission.body) ||
        typeof submission.body.quoteId !== 'string' ||
        !('sourceAccountId' in submission.body) ||
        typeof submission.body.sourceAccountId !== 'string'
      )
        return null;
      for (const field of ['recipientId', 'destinationAccountId', 'note'])
        if (
          field in submission.body &&
          typeof (submission.body as Record<string, unknown>)[field] !== 'string'
        )
          return null;
    }
    return data as TransferDraft;
  } catch {
    return null;
  }
}
export function saveDraft(draft: TransferDraft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
export function amountMinor(value: string): number | null {
  if (value.startsWith('.')) value = `0${value}`;
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(value)) return null;
  const [whole = '', fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100000000 ? amount : null;
}
