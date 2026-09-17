import { useState } from 'react';
import { Plus, ArrowRight, Users } from '@phosphor-icons/react';
import { Avatar } from '@/design-system/avatar';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { SearchInput } from '@/design-system/search-input';
import { EmptyState, ErrorState } from '@/design-system/feedback';
import { ResponsiveDialog } from '@/design-system/modal';
import { TransactionSkeleton } from '@/features/finance/loading';
import { useGetRecipientsQuery } from './transfers-api';
import { RecipientForm } from './recipient-form';
import type { Recipient } from './types';

export const countryNames: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  AE: 'United Arab Emirates',
  LB: 'Lebanon',
  CA: 'Canada',
  NL: 'Netherlands',
  ES: 'Spain',
  IE: 'Ireland',
  IT: 'Italy',
  CH: 'Switzerland',
};
export function RecipientPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (recipient: Recipient) => void;
}) {
  const query = useGetRecipientsQuery();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const filtered =
    query.data?.filter((recipient) =>
      [recipient.name, recipient.bankName, recipient.country].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    ) ?? [];
  const recent = filtered.filter((recipient) => recipient.lastUsedAt).slice(0, 3);
  function rows(items: Recipient[]) {
    return (
      <ul className="recipient-list">
        {items.map((recipient) => (
          <li key={recipient.id}>
            <button
              type="button"
              className="recipient-option"
              aria-pressed={selected === recipient.id}
              disabled={recipient.status !== 'active'}
              onClick={() => onSelect(recipient)}
            >
              <Avatar name={recipient.name} />
              <span className="recipient-copy">
                <strong>{recipient.name}</strong>
                <span>
                  {countryNames[recipient.country] ?? recipient.country} · {recipient.bankName}
                </span>
              </span>
              <span className="recipient-currency">
                {recipient.status === 'active' ? (
                  recipient.preferredCurrency
                ) : (
                  <Badge>Unavailable</Badge>
                )}
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <div className="recipient-tools">
        <SearchInput
          label="Search recipients"
          value={search}
          onValueChange={setSearch}
          placeholder="Name or bank"
        />
        <Button
          variant="secondary"
          leadingIcon={<Plus size={18} />}
          onClick={() => setAdding(true)}
        >
          New recipient
        </Button>
      </div>
      {query.isError ? (
        <ErrorState title="Recipients couldn’t load" onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <TransactionSkeleton rows={5} />
      ) : !filtered.length ? (
        <EmptyState
          icon={<Users size={30} />}
          title={search ? 'No matching recipients' : 'Your recipients will live here'}
          description={
            search
              ? 'Try another name or add a new recipient.'
              : 'Add someone to send your first demo transfer.'
          }
          action={
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add recipient
            </Button>
          }
        />
      ) : (
        <>
          {!search && recent.length > 0 && (
            <section className="recipient-group">
              <h2>Recent recipients</h2>
              {rows(recent)}
            </section>
          )}
          <section className="recipient-group">
            <h2>{search ? 'Search results' : 'All recipients'}</h2>
            {rows(filtered)}
          </section>
        </>
      )}
      <ResponsiveDialog
        open={adding}
        onOpenChange={setAdding}
        title="New recipient"
        description="A few details to send money to the right place. Use fictional details in this demo."
      >
        <RecipientForm
          onCreated={(recipient) => {
            setAdding(false);
            onSelect(recipient);
          }}
        />
      </ResponsiveDialog>
    </>
  );
}
