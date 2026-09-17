import { useState } from 'react';
import { ArrowUpRight, MagnifyingGlass } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { destinations } from '@/app/destinations';
import { ResponsiveDialog } from '@/design-system/modal';
import { SearchInput } from '@/design-system/search-input';
import { EmptyState } from '@/design-system/feedback';

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const results = destinations.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (!next) setQuery('');
  }
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={changeOpen}
      title="Find your way"
      description="A shortcut to every space in Flux."
    >
      <SearchInput
        label="Search pages"
        placeholder="Accounts, payments, settings…"
        value={query}
        onValueChange={setQuery}
      />
      <nav className="search-results" aria-label="Search results">
        {results.map(({ path, label, icon: Icon }) => (
          <Link key={path} to={path} onClick={() => changeOpen(false)}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      {results.length === 0 && (
        <EmptyState
          icon={<MagnifyingGlass size={28} />}
          title="No matching pages"
          description="Try another name, like Cards or Accounts."
        />
      )}
    </ResponsiveDialog>
  );
}
