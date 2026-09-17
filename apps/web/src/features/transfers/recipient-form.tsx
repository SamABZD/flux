import { useState } from 'react';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { currencies } from '@/features/finance/types';
import { useCreateRecipientMutation, transferError } from './transfers-api';
import type { NewRecipient, Recipient } from './types';
import { countryNames } from './recipient-picker';

export function RecipientForm({ onCreated }: { onCreated: (recipient: Recipient) => void }) {
  const [form, setForm] = useState<NewRecipient>({
    name: '',
    type: 'person',
    country: 'FR',
    preferredCurrency: 'EUR',
    bankName: '',
    accountIdentifier: '',
  });
  const [error, setError] = useState('');
  const [create, result] = useCreateRecipientMutation();
  async function submit() {
    if (
      form.name.trim().length < 2 ||
      form.bankName.trim().length < 2 ||
      !/^[A-Z0-9][A-Z0-9 -]{5,33}$/.test(form.accountIdentifier)
    ) {
      setError(
        'Enter a name, bank, and an account identifier of 6–34 letters, numbers, spaces, or dashes.',
      );
      return;
    }
    try {
      onCreated(await create(form).unwrap());
    } catch (reason) {
      setError(transferError(reason).message);
    }
  }
  return (
    <form
      className="recipient-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        label="Full name or business"
        value={form.name}
        maxLength={80}
        minLength={2}
        required
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <div className="transfer-form-pair">
        <Select
          label="Recipient type"
          value={form.type}
          onChange={(event) =>
            setForm({ ...form, type: event.target.value as NewRecipient['type'] })
          }
        >
          <option value="person">Person</option>
          <option value="business">Business</option>
        </Select>
        <Select
          label="Country"
          value={form.country}
          onChange={(event) => setForm({ ...form, country: event.target.value })}
        >
          {Object.entries(countryNames).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      <Select
        label="Receiving currency"
        value={form.preferredCurrency}
        onChange={(event) =>
          setForm({
            ...form,
            preferredCurrency: event.target.value as NewRecipient['preferredCurrency'],
          })
        }
      >
        {currencies.map((currency) => (
          <option key={currency}>{currency}</option>
        ))}
      </Select>
      <Input
        label="Bank name"
        value={form.bankName}
        minLength={2}
        maxLength={80}
        required
        onChange={(event) => setForm({ ...form, bankName: event.target.value })}
      />
      <Input
        label="Account identifier"
        value={form.accountIdentifier}
        placeholder="DEMO-FR-123456"
        hint="Fictional identifier only. 6–34 letters, numbers, spaces, or dashes."
        maxLength={34}
        minLength={6}
        required
        onChange={(event) =>
          setForm({ ...form, accountIdentifier: event.target.value.toUpperCase() })
        }
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="full-width" loading={result.isLoading}>
        Save recipient
      </Button>
    </form>
  );
}
