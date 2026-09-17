import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, ArrowUpRight, ArrowsLeftRight, DotsThree, Wallet } from '@phosphor-icons/react';
import { Button } from '@/design-system/button';
import { ResponsiveDialog } from '@/design-system/modal';
import { EmptyState } from '@/design-system/feedback';

export function QuickActions() {
  const navigate = useNavigate();
  const [action, setAction] = useState('');
  return (
    <>
      <div className="quick-actions" aria-label="Money actions">
        <Button leadingIcon={<Plus size={18} />} onClick={() => setAction('Add money')}>
          Add money
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<ArrowUpRight size={18} />}
          onClick={() => void navigate('/payments/send?again=1')}
        >
          Send
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<ArrowsLeftRight size={18} />}
          onClick={() => void navigate('/payments/exchange?again=1')}
        >
          Exchange
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<DotsThree size={20} />}
          onClick={() => setAction('More')}
        >
          More
        </Button>
      </div>
      <ResponsiveDialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) setAction('');
        }}
        title={action === 'More' ? 'Your money, at a glance' : `${action} is coming next`}
        description={
          action === 'More'
            ? 'Find the details behind your overview.'
            : 'Explore your accounts and activity while adding money is being built.'
        }
      >
        {action === 'More' ? (
          <nav className="search-results" aria-label="More account actions">
            <Link to="/accounts" onClick={() => setAction('')}>
              Your accounts <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/transactions" onClick={() => setAction('')}>
              All transactions <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </nav>
        ) : (
          <EmptyState
            icon={<Wallet size={30} />}
            title="A preview of what’s ahead"
            description="These are fictional demo balances. Adding money will be available in a later stage. You can already send and exchange within the demo."
            action={
              <Button variant="secondary" onClick={() => setAction('')}>
                Back to your money
              </Button>
            }
          />
        )}
      </ResponsiveDialog>
    </>
  );
}
