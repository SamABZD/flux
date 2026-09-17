import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Avatar } from '@/design-system/avatar';
import { Badge } from '@/design-system/badge';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { Toggle } from '@/design-system/toggle';
import { ConfirmationDialog } from '@/design-system/confirmation-dialog';
import { useToast } from '@/design-system/toast';

export function SettingsPage() {
  const [currency, setCurrency] = useState('EUR');
  const [reminders, setReminders] = useState(false);
  const notify = useToast();
  function save(event: FormEvent) {
    event.preventDefault();
    notify(
      'Preview preferences updated',
      'These controls are for this preview only and reset when you leave Settings.',
    );
  }
  return (
    <>
      <PageHeader
        title="Settings"
        description="A few details that make this space yours."
        actions={<Badge>Preview</Badge>}
      />
      <div className="settings-layout">
        <aside className="settings-profile">
          <Avatar name="Alex Morgan" size="large" />
          <h2>Alex Morgan</h2>
          <p>demo@flux.example</p>
          <Badge>Demo profile</Badge>
        </aside>
        <form className="settings-form" onSubmit={save}>
          <section className="settings-section">
            <SectionHeader
              title="Your profile"
              description="An example identity for exploring the experience."
            />
            <div className="settings-fields">
              <Input
                label="Full name"
                value="Alex Morgan"
                readOnly
                hint="Profile editing will be available later."
              />
              <Input label="Email address" type="email" value="demo@flux.example" readOnly />
            </div>
          </section>
          <section className="settings-section">
            <SectionHeader
              title="Preferences"
              description="Try the controls. Nothing is sent or saved."
            />
            <div className="settings-fields">
              <Select
                label="Display currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="EUR">Euro · EUR</option>
                <option value="USD">US Dollar · USD</option>
                <option value="GBP">British Pound · GBP</option>
              </Select>
              <Select label="Appearance" value="graphite" disabled>
                <option value="graphite">Graphite</option>
              </Select>
            </div>
            <Toggle
              label="Helpful reminders"
              description="Preview the switch. No notifications will be sent."
              checked={reminders}
              onCheckedChange={setReminders}
            />
          </section>
          <section className="settings-section">
            <SectionHeader
              title="Security"
              description="Sign-in and security controls are not connected in this preview."
            />
            <Toggle
              label="Passkey sign-in"
              description="A simpler way back, coming in a later release."
              checked={false}
              onCheckedChange={() => undefined}
              disabled
            />
          </section>
          <div className="settings-actions">
            <Button type="submit">Apply preview</Button>
            <ConfirmationDialog
              trigger={<Button variant="ghost">Reset preview</Button>}
              title="Reset preview preferences?"
              description="This returns the controls on this page to their starting values. No account data is affected."
              confirmLabel="Reset preferences"
              onConfirm={() => {
                setCurrency('EUR');
                setReminders(false);
                notify('Preview reset', 'The controls are back to their starting values.');
              }}
            />
          </div>
          <p className="settings-disclaimer">
            Preview preferences last while you are on this page.
          </p>
        </form>
      </div>
    </>
  );
}
