import { useState } from 'react';
import { Bell, Plus, ArrowRight, Receipt } from '@phosphor-icons/react';
import { Button, IconButton } from './button';
import { Input } from './input';
import { PasswordInput } from './password-input';
import { SearchInput } from './search-input';
import { MoneyInput } from './money-input';
import { Select } from './select';
import { Tabs } from './tabs';
import { Toggle } from './toggle';
import { Badge } from './badge';
import { Avatar } from './avatar';
import { Modal, BottomSheet } from './modal';
import { ConfirmationDialog } from './confirmation-dialog';
import { Tooltip } from './tooltip';
import { useToast } from './toast';
import { Skeleton, EmptyState, ErrorState } from './feedback';

export function ActionExamples() {
  return (
    <div className="gallery-row">
      <Button leadingIcon={<Plus size={18} />}>Primary action</Button>
      <Button variant="secondary" trailingIcon={<ArrowRight size={18} />}>
        Secondary
      </Button>
      <Button variant="ghost">Quiet action</Button>
      <Button variant="danger">Remove</Button>
      <Button disabled>Unavailable</Button>
      <Button loading>Processing</Button>
      <Tooltip content="A helpful label">
        <IconButton label="Example notifications">
          <Bell size={20} />
        </IconButton>
      </Tooltip>
    </div>
  );
}
export function FieldExamples() {
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState('120.00');
  return (
    <div className="gallery-fields">
      <Input label="Account name" placeholder="Everyday account" hint="A short, familiar name." />
      <Input
        label="Email address"
        type="email"
        defaultValue="alex@"
        error="Enter a valid email address."
      />
      <Input label="Account reference" value="Not available yet" disabled />
      <PasswordInput label="Password" placeholder="Enter your password" />
      <SearchInput
        label="Search"
        placeholder="Find something…"
        value={query}
        onValueChange={setQuery}
      />
      <MoneyInput
        label="Amount"
        currency="EUR"
        value={amount}
        onValueChange={setAmount}
        hint="Decimal text only. No money moves."
      />
      <Select label="Currency" defaultValue="EUR">
        <option value="EUR">Euro · EUR</option>
        <option value="USD">US Dollar · USD</option>
      </Select>
    </div>
  );
}
export function SelectionExamples() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="gallery-stack">
      <Tabs
        label="Example account tabs"
        defaultValue="overview"
        items={[
          {
            value: 'overview',
            label: 'Overview',
            content: <p>An overview of the account will appear here.</p>,
          },
          { value: 'details', label: 'Details', content: <p>Account details will appear here.</p> },
          { value: 'statements', label: 'Statements', content: null, disabled: true },
        ]}
      />
      <Toggle
        label="Balance visibility"
        description="A switch with keyboard and touch support."
        checked={enabled}
        onCheckedChange={setEnabled}
      />
      <Toggle
        label="Not available yet"
        checked={false}
        onCheckedChange={() => undefined}
        disabled
      />
      <div className="gallery-row">
        <Avatar name="Alex Morgan" />
        <Avatar name="Jamie Lee" size="small" />
        <Badge>Preview</Badge>
        <Badge tone="success">Complete</Badge>
        <Badge tone="error">Failed</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="info">Information</Badge>
      </div>
    </div>
  );
}
export function OverlayExamples() {
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const notify = useToast();
  return (
    <div className="gallery-row">
      <Button variant="secondary" onClick={() => setModal(true)}>
        Open modal
      </Button>
      <Button variant="secondary" onClick={() => setSheet(true)}>
        Open bottom sheet
      </Button>
      <ConfirmationDialog
        title="Reset example?"
        description="Only this demonstration is affected. No accounts or preferences will change."
        confirmLabel="Reset example"
        trigger={<Button variant="secondary">Open confirmation</Button>}
        onConfirm={() => notify('Example reset')}
      />
      <Button
        variant="secondary"
        onClick={() => notify('A little feedback', 'Your action has been acknowledged.')}
      >
        Show toast
      </Button>
      <Modal
        open={modal}
        onOpenChange={setModal}
        title="A focused moment"
        description="Tab stays inside this dialog. Escape closes it and returns focus."
      >
        <Input label="Example name" placeholder="Try keyboard navigation" />
        <div className="dialog-actions">
          <Button onClick={() => setModal(false)}>Done</Button>
        </div>
      </Modal>
      <BottomSheet
        open={sheet}
        onOpenChange={setSheet}
        title="Within easy reach"
        description="The same accessible dialog, anchored for a smaller screen."
      >
        <p>Useful actions stay close to your thumb.</p>
        <div className="dialog-actions">
          <Button onClick={() => setSheet(false)}>Done</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
export function FeedbackExamples() {
  const notify = useToast();
  return (
    <div className="gallery-stack">
      <div className="gallery-stack" role="status" aria-label="Loading account summary">
        <Skeleton width="35%" />
        <Skeleton height="2rem" />
        <Skeleton width="65%" />
      </div>
      <ErrorState
        description="This is a sample connection error. Try again to see the feedback."
        onRetry={() => notify('Retry acknowledged', 'This is an example; no request was sent.')}
      />
      <EmptyState
        icon={<Receipt size={30} />}
        title="No activity yet"
        description="Your account activity will appear here when it becomes available."
      />
    </div>
  );
}
