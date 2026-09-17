import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowUpRight, Flask } from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { MoneyInput } from '@/design-system/money-input';
import { Select } from '@/design-system/select';
import { Toggle } from '@/design-system/toggle';
import { ErrorState } from '@/design-system/feedback';
import { BalanceSkeleton } from '@/features/finance/loading';
import { categories, currencies } from '@/features/finance/types';
import { categoryNames } from '@/features/finance/format';
import { amountMinor } from '@/features/transfers/draft';
import { transferError } from '@/features/transfers/transfers-api';
import {
  useGetCardsQuery,
  usePatchCardMutation,
  useAuthorizeCardMutation,
  useLazyGetCardPaymentByKeyQuery,
  useEnrollWalletMutation,
} from './cards-api';
import { PaymentOutcome } from './card-payment-details';
import { CardPaymentList } from './card-history';
import { readPendingPayment, savePendingPayment, clearPendingPayment } from './pending-payment';
import type { PendingCardPayment } from './pending-payment';
import type {
  Card,
  CardPatch,
  CardPayment,
  CardPaymentRequest,
  CardPaymentType,
  CardType,
  WalletOutcome,
} from './types';
import { cardMoney, cardTypeNames, cardStatusNames, methodNames, paymentTypes } from './types';
import './cards.css';
interface Scenario {
  letter: string;
  name: string;
  type: CardType;
  merchant: string;
  amount: string;
  currency: string;
  method: CardPaymentType;
  category: CardPaymentRequest['merchantCategory'];
  expect: string;
  setup: string;
  patch: (card: Card) => CardPatch;
}
const ready: CardPatch = { status: 'ACTIVE', onlinePayments: true, monthlyLimitMinor: null };
export const scenarios: Scenario[] = [
  {
    letter: 'A',
    name: 'Physical purchase',
    type: 'PHYSICAL',
    merchant: 'Roadster',
    amount: '28.00',
    currency: 'USD',
    method: 'CONTACTLESS',
    category: 'dining',
    expect: 'Completed contactless purchase.',
    setup: 'Unfreeze, enable contactless, remove the monthly limit and turn location security off.',
    patch: () => ({ ...ready, contactlessPayments: true, locationSecurity: false }),
  },
  {
    letter: 'B',
    name: 'Frozen card',
    type: 'PHYSICAL',
    merchant: 'Roadster',
    amount: '28.00',
    currency: 'USD',
    method: 'CONTACTLESS',
    category: 'dining',
    expect: 'Declined · Card frozen.',
    setup: 'Freeze this physical card.',
    patch: () => ({ status: 'FROZEN' }),
  },
  {
    letter: 'C',
    name: 'Online disabled',
    type: 'PHYSICAL',
    merchant: 'Amazon',
    amount: '70.00',
    currency: 'USD',
    method: 'ONLINE',
    category: 'shopping',
    expect: 'Declined · Online payments disabled.',
    setup: 'Unfreeze this card and disable online payments.',
    patch: () => ({ status: 'ACTIVE', onlinePayments: false }),
  },
  {
    letter: 'D',
    name: 'Virtual subscription',
    type: 'VIRTUAL',
    merchant: 'Netflix',
    amount: '15.49',
    currency: 'USD',
    method: 'RECURRING',
    category: 'subscriptions',
    expect: 'Completed recurring payment.',
    setup: 'Unfreeze, enable online payments and remove the monthly limit.',
    patch: () => ready,
  },
  {
    letter: 'E',
    name: 'Single-use refresh',
    type: 'SINGLE_USE',
    merchant: 'Amazon',
    amount: '42.00',
    currency: 'USD',
    method: 'ONLINE',
    category: 'shopping',
    expect: 'Completed · Card details refresh.',
    setup: 'Unfreeze, enable online payments and remove the monthly limit.',
    patch: () => ready,
  },
  {
    letter: 'F',
    name: 'Single-use subscription',
    type: 'SINGLE_USE',
    merchant: 'Netflix',
    amount: '15.49',
    currency: 'USD',
    method: 'RECURRING',
    category: 'subscriptions',
    expect: 'Declined · Single-use cards cannot pay subscriptions.',
    setup: 'Unfreeze, enable online payments and remove the monthly limit.',
    patch: () => ready,
  },
  {
    letter: 'G',
    name: 'Monthly limit',
    type: 'PHYSICAL',
    merchant: 'Roadster',
    amount: '10.00',
    currency: 'USD',
    method: 'CONTACTLESS',
    category: 'dining',
    expect: 'Declined · $10 purchase exceeds $5 remaining.',
    setup:
      'Unfreeze, enable contactless, turn location security off and set the limit to this month’s spending plus $5.',
    patch: (card) => ({
      ...ready,
      contactlessPayments: true,
      locationSecurity: false,
      monthlyLimitMinor: card.monthlyLimit.spentMinor + 500,
    }),
  },
  {
    letter: 'H',
    name: 'Foreign-currency funding',
    type: 'VIRTUAL',
    merchant: 'Atlas Travel',
    amount: '3000.00',
    currency: 'EUR',
    method: 'ONLINE',
    category: 'travel',
    expect: 'With seeded balances: USD funding, FX fee, ledger and activity update.',
    setup:
      'Unfreeze, enable online payments and remove the monthly limit. This example exceeds the seeded EUR balance.',
    patch: () => ready,
  },
];
export function CardSimulator() {
  const query = useGetCardsQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [pending, setPending] = useState<PendingCardPayment | null>(readPendingPayment);
  const [selected, setSelected] = useState(pending?.body.cardId ?? '');
  const [merchant, setMerchant] = useState(pending?.body.merchantName ?? 'Roadster');
  const [amount, setAmount] = useState(
    pending ? (pending.body.amountMinor / 100).toFixed(2) : '28.00',
  );
  const [currency, setCurrency] = useState(pending?.body.currency ?? 'USD');
  const [method, setMethod] = useState<CardPaymentType>(pending?.body.paymentType ?? 'CONTACTLESS');
  const [category, setCategory] = useState<CardPaymentRequest['merchantCategory']>(
    pending?.body.merchantCategory ?? 'dining',
  );
  const [merchantCountry, setMerchantCountry] = useState(pending?.body.merchantLocation ?? 'LB');
  const [holderCountry, setHolderCountry] = useState(pending?.body.cardholderLocation ?? 'LB');
  const [subscription, setSubscription] = useState(pending?.body.isSubscription ?? false);
  const [pin, setPin] = useState(pending?.body.requiresPin ?? false);
  const [note, setNote] = useState(pending?.body.note ?? '');
  const [savedVersion, setSavedVersion] = useState<{ cardId: string; version: number } | null>(
    null,
  );
  const [useSaved, setUseSaved] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [setupDone, setSetupDone] = useState(false);
  const [result, setResult] = useState<CardPayment | null>(null);
  const [error, setError] = useState('');
  const [walletResult, setWalletResult] = useState<WalletOutcome | null>(null);
  const [patch, { isLoading: preparing }] = usePatchCardMutation();
  const [authorize, { isLoading: paying }] = useAuthorizeCardMutation();
  const [lookup, { isFetching: checking }] = useLazyGetCardPaymentByKeyQuery();
  const [wallet, { isLoading: enrolling }] = useEnrollWalletMutation();
  const inFlight = useRef(false);
  const card =
    query.data?.find((item) => item.id === selected) ??
    (!selected ? query.data?.find((item) => item.type === 'PHYSICAL') : undefined);
  const busy = preparing || paying || checking || enrolling;
  const locked = busy || Boolean(pending);
  const invalid =
    amountMinor(amount) === null ||
    merchant.trim().length < 2 ||
    !card ||
    ![merchantCountry, holderCountry].every(
      (country) => country === '' || /^[A-Z]{2}$/.test(country),
    );
  const choose = (item: Scenario) => {
    const target = query.data?.find(
      (card) => card.type === item.type && !['TERMINATED', 'EXPIRED'].includes(card.status),
    );
    if (!target) {
      setError(`Create a ${cardTypeNames[item.type].toLowerCase()} card first.`);
      return;
    }
    setScenario(item);
    setSetupDone(false);
    setSelected(target.id);
    setMerchant(item.merchant);
    setAmount(item.amount);
    setCurrency(item.currency);
    setMethod(item.method);
    setCategory(item.category);
    setSubscription(item.method === 'RECURRING');
    setPin(false);
    setMerchantCountry('LB');
    setHolderCountry('LB');
    setUseSaved(false);
    setResult(null);
    setError('');
    setWalletResult(null);
  };
  const prepare = async () => {
    if (!scenario || !card) return;
    setError('');
    try {
      await patch({ id: card.id, body: scenario.patch(card) }).unwrap();
      setSetupDone(true);
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  const finish = (payment: CardPayment) => {
    clearPendingPayment();
    setPending(null);
    setResult(payment);
    setError('');
  };
  const send = async () => {
    if (inFlight.current || !card) return;
    inFlight.current = true;
    setError('');
    setWalletResult(null);
    let submission = pending;
    try {
      if (!submission) {
        const minor = amountMinor(amount);
        if (minor === null) return;
        const body: CardPaymentRequest = {
          cardId: card.id,
          credentialVersion:
            useSaved && savedVersion?.cardId === card.id
              ? savedVersion.version
              : card.credentialVersion,
          merchantName: merchant.trim(),
          merchantCategory: category,
          amountMinor: minor,
          currency,
          paymentType: method,
          isSubscription: subscription,
          requiresPin: pin,
          note,
        };
        if (merchantCountry) body.merchantLocation = merchantCountry;
        if (holderCountry) body.cardholderLocation = holderCountry;
        submission = { key: crypto.randomUUID(), body };
        try {
          savePendingPayment(submission);
        } catch {
          setError(
            'Enable storage for this tab so a payment can be retried safely. No request was sent.',
          );
          return;
        }
        setPending(submission);
        setSavedVersion({ cardId: card.id, version: body.credentialVersion });
      }
      setResult(null);
      try {
        finish(await authorize(submission).unwrap());
      } catch (err) {
        const issue = transferError(err);
        if (issue.ambiguous)
          setError(
            'The payment result is uncertain. Check the result or retry this exact payment before starting another.',
          );
        else {
          clearPendingPayment();
          setPending(null);
          setError(issue.message);
        }
      }
    } finally {
      inFlight.current = false;
    }
  };
  const check = async () => {
    if (!pending) return;
    setError('');
    try {
      const response = await lookup(pending.key).unwrap();
      if (response.payment) finish(response.payment);
      else setError('No result is recorded yet. Retry the saved payment with the same key.');
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  const enroll = async () => {
    if (!card) return;
    setError('');
    try {
      setWalletResult(await wallet(card.id).unwrap());
    } catch (err) {
      setError(transferError(err).message);
    }
  };
  return (
    <>
      <Link className="text-link back-link" to="/cards">
        <ArrowLeft size={17} aria-hidden="true" />
        Cards
      </Link>
      <PageHeader
        title="Card payment simulator"
        description="Demo Tools · Real demo logic. Fictional money."
      />
      <p className="card-simulation-banner">
        <Flask size={21} aria-hidden="true" />
        Run an authorization against Flux’s card controls, accounts and ledger. This does not
        contact a real payment network.
      </p>
      {query.isError ? (
        <ErrorState title="Cards unavailable" onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <BalanceSkeleton />
      ) : (
        <>
          <section className="card-scenarios">
            <SectionHeader
              title="Try a scenario"
              description="Choose an example, apply its stated settings, then run the payment."
            />
            <div className="card-scenario-grid">
              {scenarios.map((item) => (
                <button
                  className="card-scenario"
                  aria-pressed={scenario?.letter === item.letter}
                  key={item.letter}
                  disabled={locked}
                  onClick={() => choose(item)}
                >
                  <span>{item.letter}</span>
                  <strong>{item.name}</strong>
                </button>
              ))}
            </div>
            {scenario && (
              <div className="card-scenario-setup">
                <div>
                  <strong>{scenario.expect}</strong>
                  <p>{scenario.setup}</p>
                  <p>
                    Available account funds and other card controls still apply. Setup changes
                    remain saved on this demo card.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void prepare()}
                  loading={preparing}
                  disabled={locked && !preparing}
                >
                  {setupDone ? 'Apply setup again' : 'Apply scenario setup'}
                </Button>
                {setupDone && <span role="status">Settings applied.</span>}
              </div>
            )}
          </section>
          <div className="card-simulator-grid">
            <form
              className="card-simulator-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Select
                label="Card"
                value={card?.id ?? ''}
                disabled={locked}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setUseSaved(false);
                  setScenario(null);
                  setResult(null);
                  setWalletResult(null);
                }}
              >
                {query.data.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label} · {cardTypeNames[item.type]} · {cardStatusNames[item.status]} ·{' '}
                    {item.last4}
                  </option>
                ))}
              </Select>
              {card && (
                <Link className="text-link" to={`/cards/${card.id}`}>
                  Manage {card.label} <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              )}
              <Input
                label="Merchant"
                maxLength={80}
                value={merchant}
                disabled={locked}
                onChange={(e) => setMerchant(e.target.value)}
              />
              <div className="card-form-pair">
                <MoneyInput
                  label="Purchase amount"
                  currency={currency}
                  value={amount}
                  onValueChange={setAmount}
                  disabled={locked}
                />
                <Select
                  label="Currency"
                  value={currency}
                  disabled={locked}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {currencies.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                  <option value="BTC">BTC · unsupported</option>
                </Select>
              </div>
              <div className="card-form-pair">
                <Select
                  label="Payment type"
                  value={method}
                  disabled={locked}
                  onChange={(e) => setMethod(e.target.value as CardPaymentType)}
                >
                  {paymentTypes.map((value) => (
                    <option key={value} value={value}>
                      {methodNames[value]}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Merchant category"
                  value={category}
                  disabled={locked}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                >
                  {categories
                    .filter((value) => value !== 'income' && value !== 'transfers')
                    .map((value) => (
                      <option key={value} value={value}>
                        {categoryNames[value]}
                      </option>
                    ))}
                </Select>
              </div>
              <details className="card-simulator-advanced">
                <summary>Location & advanced checks</summary>
                <div className="card-form">
                  <div className="card-form-pair">
                    <Input
                      label="Merchant country"
                      hint="Simulated ISO code, e.g. LB"
                      maxLength={2}
                      value={merchantCountry}
                      disabled={locked}
                      onChange={(e) => setMerchantCountry(e.target.value.toUpperCase())}
                    />
                    <Input
                      label="Cardholder country"
                      hint="Simulated ISO code, e.g. LB"
                      maxLength={2}
                      value={holderCountry}
                      disabled={locked}
                      onChange={(e) => setHolderCountry(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Toggle
                    label="Subscription-style charge"
                    description="Also tests a subscription submitted as an online payment."
                    checked={subscription}
                    disabled={locked}
                    onCheckedChange={setSubscription}
                  />
                  <Toggle
                    label="Requires PIN"
                    description="Single-use cards reject transactions requiring a PIN."
                    checked={pin}
                    disabled={locked}
                    onCheckedChange={setPin}
                  />
                  <Toggle
                    label="Use details from the last attempt"
                    description={
                      savedVersion?.cardId === card?.id
                        ? `Test saved credential version ${savedVersion?.version}. Refreshed single-use details make old versions unusable.`
                        : 'Run a payment with this card to save its version for a reuse test.'
                    }
                    checked={useSaved}
                    disabled={locked || savedVersion?.cardId !== card?.id}
                    onCheckedChange={setUseSaved}
                  />
                  <Input
                    label="Demo note"
                    value={note}
                    maxLength={140}
                    disabled={locked}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </details>
              {pending && (
                <div className="card-notice" role="status">
                  <p>
                    A payment request is saved on this tab: {pending.body.merchantName},{' '}
                    {cardMoney(pending.body.amountMinor, pending.body.currency)}. Its amount and key
                    stay unchanged until a result is confirmed.
                  </p>
                  <Button
                    variant="secondary"
                    loading={checking}
                    disabled={busy && !checking}
                    onClick={() => void check()}
                  >
                    Check saved result
                  </Button>
                </div>
              )}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" loading={paying} disabled={invalid || (busy && !paying)}>
                {pending ? 'Retry saved payment' : 'Run simulated payment'}
              </Button>
            </form>
            <aside className="card-simulator-guide">
              <h2>How funding works</h2>
              <ol>
                <li>Use a funded account in the purchase currency.</li>
                <li>If needed, try one account in order: USD, EUR, GBP, AED.</li>
                <li>
                  For FX, include the authoritative rate and fee before checking available funds.
                </li>
              </ol>
              <p>
                Balances are never combined. FX uses the shared rate engine: 0.4% fee, with a
                minimum equivalent to $0.50. Same-currency purchases have no FX fee.
              </p>
              <Link className="text-link" to="/accounts">
                Inspect account balances
              </Link>
              <div className="card-wallet-demo">
                <h3>Demo wallet enrollment</h3>
                <p>
                  Physical and reusable virtual cards support a simulated wallet. Single-use cards
                  reject enrollment. Raw contactless and wallet payments are separate methods.
                </p>
                <Button
                  variant="secondary"
                  disabled={!card || locked}
                  loading={enrolling}
                  onClick={() => void enroll()}
                >
                  Simulate wallet enrollment
                </Button>
                {card?.walletEnrolled && <p>Selected card is enrolled in the demo wallet.</p>}
                {walletResult && (
                  <p role="status">
                    {walletResult.message} {walletResult.action}
                  </p>
                )}
              </div>
            </aside>
          </div>
          {result && (
            <section className="card-simulator-result" aria-label="Simulation result">
              <PaymentOutcome payment={result} />
              <CardPaymentList payments={[result]} />
              <div className="card-result-links">
                <Link className="text-link" to={`/cards/payments/${result.id}`}>
                  Full payment details & refund
                </Link>
                <Link className="text-link" to={`/cards/${result.card.id}`}>
                  View card{result.card.type === 'SINGLE_USE' ? ' & refreshed details' : ''}
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
