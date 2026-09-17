import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createAppStore } from '@/app/store';
import { financeApi } from '@/features/finance/finance-api';
import { ToastProvider } from '@/design-system/toast';
import { CardsPage } from './cards-page';
import { CardSimulator } from './card-simulator';
import { CardPaymentDetails } from './card-payment-details';
import { SecureReveal } from './secure-reveal';
import { cardFixture, cardPaymentFixture } from '../../../test/card-fixtures';
import { CARD_PENDING_KEY, readPendingPayment, savePendingPayment } from './pending-payment';
import type { Card, CardPatch, CardPayment, CardPaymentRequest } from './types';

let fetchMock: jest.SpyInstance, cards: Card[], payment: CardPayment | null;
let mode: 'success' | 'patch-failure' | 'lost-before' | 'lost-after' | 'refund-lost' | 'session';
let submissions: { key: string | null; body: CardPaymentRequest }[],
  refunds: { key: string | null; reason: string }[];
const syntheticNumber = '0000123412341234',
  syntheticCvv = '817';
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  cards = [cardFixture(), cardFixture('VIRTUAL'), cardFixture('SINGLE_USE')];
  payment = null;
  mode = 'success';
  submissions = [];
  refunds = [];
  HTMLElement.prototype.scrollIntoView = jest.fn();
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname === '/session/demo')
        return Response.json({ userId: 'demo-alex', mode: 'demo' });
      if (url.pathname === '/cards' && request.method === 'GET') return Response.json(cards);
      if (url.pathname.endsWith('/audit')) return Response.json([]);
      if (url.pathname.endsWith('/reveal')) {
        const body = (await request.json()) as { pin: string };
        return body.pin === '4821'
          ? Response.json({
              number: syntheticNumber,
              cvv: syntheticCvv,
              expiryMonth: 8,
              expiryYear: 2029,
              credentialVersion: 1,
              synthetic: true,
              hideAfterSeconds: 30,
            })
          : Response.json({ message: 'Incorrect demo PIN' }, { status: 403 });
      }
      if (url.pathname.startsWith('/cards/') && request.method === 'PATCH') {
        if (mode === 'patch-failure')
          return Response.json({ message: 'Unable to save this setting.' }, { status: 500 });
        const card = cards.find((c) => url.pathname === `/cards/${c.id}`)!;
        const patch = (await request.json()) as CardPatch;
        if (patch.status) card.status = patch.status;
        if (patch.label) card.label = patch.label;
        if (patch.monthlyLimitMinor !== undefined) {
          card.monthlyLimit.enabled = patch.monthlyLimitMinor !== null;
          card.monthlyLimit.amountMinor = patch.monthlyLimitMinor;
        }
        for (const key of Object.keys(card.security) as (keyof Card['security'])[]) {
          if (typeof patch[key] === 'boolean') card.security[key] = patch[key];
        }
        return Response.json(card);
      }
      if (url.pathname === '/card-payments/authorize') {
        submissions.push({
          key: request.headers.get('Idempotency-Key'),
          body: (await request.json()) as CardPaymentRequest,
        });
        if (mode === 'session' && submissions.length === 1)
          return Response.json({ message: 'Session expired' }, { status: 401 });
        if (mode === 'lost-before' && submissions.length === 1) throw new TypeError('Offline');
        payment ??= cardPaymentFixture();
        if (mode === 'lost-after' && submissions.length === 1)
          throw new TypeError('Connection lost');
        return Response.json(payment);
      }
      if (url.pathname.startsWith('/card-payments/by-key/')) return Response.json({ payment });
      if (url.pathname.endsWith('/refund')) {
        refunds.push({
          key: request.headers.get('Idempotency-Key'),
          reason: ((await request.json()) as { reason: string }).reason,
        });
        payment = {
          ...payment!,
          status: 'REFUNDED',
          refundedAt: '2026-09-15T11:00:00Z',
          refund: {
            id: 'refund-1',
            reason: refunds[0]!.reason,
            reference: 'REF-TEST',
            createdAt: '2026-09-15T11:00:00Z',
          },
        };
        if (mode === 'refund-lost' && refunds.length === 1) throw new TypeError('Connection lost');
        return Response.json(payment);
      }
      if (url.pathname === '/card-payments') return Response.json(payment ? [payment] : []);
      if (url.pathname.startsWith('/card-payments/')) return Response.json(payment);
      throw new Error(`Unexpected test route ${url.pathname}`);
    });
});
afterEach(() => {
  fetchMock.mockRestore();
  jest.useRealTimers();
});
function mount(path = '/cards') {
  const store = createAppStore();
  const result = render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/:id" element={<CardsPage />} />
            <Route path="/demo/card-payments" element={<CardSimulator />} />
            <Route path="/cards/payments/:id" element={<CardPaymentDetails />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  );
  return {
    ...result,
    store,
    dispose: () => {
      result.unmount();
      store.dispatch(financeApi.util.resetApiState());
    },
  };
}
test.each(['VIRTUAL', 'SINGLE_USE'] as const)(
  'exposes only relevant controls for %s',
  async (type) => {
    const view = mount(`/cards/card-${type.toLowerCase()}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('switch', { name: 'Online payments' })).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'ATM withdrawals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Contactless payments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Magnetic stripe' })).not.toBeInTheDocument();
    view.dispose();
  },
);
test('freeze is confirmed by the server; failed unfreeze retains the frozen state and explains retry', async () => {
  const view = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Freeze' }));
  await screen.findByRole('button', { name: 'Unfreeze' });
  expect(cards[0]!.status).toBe('FROZEN');
  mode = 'patch-failure';
  await user.click(screen.getByRole('button', { name: 'Unfreeze' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
  expect(screen.getByRole('button', { name: 'Unfreeze' })).toBeEnabled();
  view.dispose();
});
test('security setting failures retain the server-confirmed checked state', async () => {
  mode = 'patch-failure';
  const view = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('switch', { name: 'Contactless payments' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('switch', { name: 'Contactless payments' })).toBeChecked();
  view.dispose();
});
test('secure details require PIN, avoid Redux/storage, copy without exposing values in notifications, and hide on blur', async () => {
  const view = mount();
  const user = userEvent.setup();
  const clipboard = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await user.click(await screen.findByRole('button', { name: 'View details' }));
  await user.type(screen.getByLabelText('Demo PIN'), '1111');
  await user.click(screen.getByRole('button', { name: 'Reveal for 30 seconds' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('didn’t match');
  await user.clear(screen.getByLabelText('Demo PIN'));
  await user.type(screen.getByLabelText('Demo PIN'), '4821');
  await user.click(screen.getByRole('button', { name: 'Reveal for 30 seconds' }));
  await screen.findByRole('button', { name: 'Copy card number' });
  expect(document.querySelector('[data-sensitive]')).not.toBeNull();
  for (const data of [view.store.getState(), { ...localStorage }, { ...sessionStorage }]) {
    const json = JSON.stringify(data);
    expect(json.includes(syntheticNumber)).toBe(false);
    expect(json.includes(syntheticCvv)).toBe(false);
  }
  await user.click(screen.getByRole('button', { name: 'Copy card number' }));
  expect(clipboard).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('status', { name: syntheticNumber })).not.toBeInTheDocument();
  fireEvent(window, new Event('blur'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(document.querySelector('[data-sensitive]')).toBeNull();
  clipboard.mockRestore();
  view.dispose();
});
test('revealed values automatically disappear after 30 seconds', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  let closed = false;
  const view = render(
    <ToastProvider>
      <SecureReveal
        card={cardFixture()}
        onClose={() => {
          closed = true;
        }}
      />
    </ToastProvider>,
  );
  await user.type(screen.getByLabelText('Demo PIN'), '4821');
  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'Reveal for 30 seconds' }));
  });
  await screen.findByRole('button', { name: 'Copy cvv' });
  act(() => jest.advanceTimersByTime(30001));
  expect(closed).toBe(true);
  expect(document.querySelector('[data-sensitive]')).toBeNull();
  view.unmount();
});
test('leaving during reveal aborts the request and ignores a late sensitive response', async () => {
  let signal: AbortSignal | undefined;
  let release: (value: Response) => void = () => {};
  fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((resolve) => {
      release = resolve;
    });
  });
  const user = userEvent.setup();
  const view = render(
    <ToastProvider>
      <SecureReveal card={cardFixture()} onClose={() => {}} />
    </ToastProvider>,
  );
  await user.type(screen.getByLabelText('Demo PIN'), '4821');
  await user.click(screen.getByRole('button', { name: 'Reveal for 30 seconds' }));
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    release(
      Response.json({
        number: syntheticNumber,
        cvv: syntheticCvv,
        expiryMonth: 8,
        expiryYear: 2029,
        credentialVersion: 1,
        synthetic: true,
      }),
    );
    await Promise.resolve();
  });
  expect(document.querySelector('[data-sensitive]')).toBeNull();
});
test.each(['lost-before', 'lost-after', 'session'] as const)(
  'recovers %s using one unchanged idempotency key and request',
  async (scenario) => {
    mode = scenario;
    let view = mount('/demo/card-payments');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run simulated payment' }));
    if (scenario !== 'session') {
      await screen.findByRole('alert');
      const saved = readPendingPayment();
      expect(saved).not.toBeNull();
      expect(screen.getByLabelText('Merchant')).toBeDisabled();
      view.dispose();
      view = mount('/demo/card-payments');
      await user.click(await screen.findByRole('button', { name: 'Retry saved payment' }));
    }
    await screen.findByRole('heading', { name: 'Payment completed' });
    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toEqual(submissions[1]);
    expect(readPendingPayment()).toBeNull();
    expect(submissions[0]!.body).not.toHaveProperty('balanceMinor');
    expect(submissions[0]!.body).not.toHaveProperty('billingAmountMinor');
    view.dispose();
  },
);
test('a lookup recovers a lost successful response without posting a second payment', async () => {
  mode = 'lost-after';
  const view = mount('/demo/card-payments');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Run simulated payment' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Check saved result' }));
  await screen.findByRole('heading', { name: 'Payment completed' });
  expect(submissions).toHaveLength(1);
  expect(sessionStorage.getItem(CARD_PENDING_KEY)).toBeNull();
  view.dispose();
});
test('blocked session storage prevents sending an unrecoverable request', async () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  const view = mount('/demo/card-payments');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Run simulated payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No request was sent');
  expect(submissions).toHaveLength(0);
  spy.mockRestore();
  view.dispose();
});
test('refund retry after a lost response preserves reason and key', async () => {
  payment = cardPaymentFixture();
  mode = 'refund-lost';
  const view = mount('/cards/payments/payment-1');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Payment completed' });
  await user.click(screen.getByText('Demo Tools', { selector: 'summary' }));
  await user.click(screen.getByRole('button', { name: 'Simulate refund' }));
  await user.click(screen.getByRole('button', { name: 'Refund full amount' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByRole('alert');
  await user.click(within(dialog).getByRole('button', { name: 'Retry saved refund' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(refunds).toHaveLength(2);
  expect(refunds[0]).toEqual(refunds[1]);
  expect(await screen.findByRole('heading', { name: 'Payment refunded' })).toBeVisible();
  view.dispose();
});
test('restored storage is allowlisted and drops credential-like extra fields', () => {
  savePendingPayment({
    key: '11111111-1111-4111-8111-111111111111',
    body: {
      cardId: 'card-physical',
      credentialVersion: 1,
      merchantName: 'Shop',
      merchantCategory: 'shopping',
      amountMinor: 100,
      currency: 'USD',
      paymentType: 'ONLINE',
    },
  });
  const value = JSON.parse(sessionStorage.getItem(CARD_PENDING_KEY)!) as {
    body: Record<string, unknown>;
  };
  value.body.number = syntheticNumber;
  value.body.cvv = syntheticCvv;
  sessionStorage.setItem(CARD_PENDING_KEY, JSON.stringify(value));
  expect(readPendingPayment()?.body).not.toHaveProperty('number');
  expect(readPendingPayment()?.body).not.toHaveProperty('cvv');
  sessionStorage.setItem(CARD_PENDING_KEY, '{broken');
  expect(readPendingPayment()).toBeNull();
});
