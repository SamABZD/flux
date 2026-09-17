import { useState } from 'react';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { useToast } from '@/design-system/toast';
import { categoryNames } from './format';
import { useUpdateCategoryMutation } from './finance-api';
import { categories } from './types';
import type { Transaction, TransactionCategory } from './types';

export function CategoryEditor({ transaction }: { transaction: Transaction }) {
  const [category, setCategory] = useState<TransactionCategory>(transaction.category);
  const [update, result] = useUpdateCategoryMutation();
  const notify = useToast();
  async function save() {
    try {
      await update({ id: transaction.id, category }).unwrap();
      notify('Category updated', `This transaction is now in ${categoryNames[category]}.`);
    } catch (error) {
      void error;
    }
  }
  return (
    <form
      className="category-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <h2>Category</h2>
        <p>Keep your activity organized. This also updates your spending breakdown.</p>
      </div>
      <div className="category-editor-controls">
        <Select
          label="Transaction category"
          value={category}
          disabled={result.isLoading}
          onChange={(event) => {
            setCategory(event.target.value as TransactionCategory);
            result.reset();
          }}
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {categoryNames[value]}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          loading={result.isLoading}
          disabled={category === transaction.category}
        >
          {result.isError ? 'Retry update' : 'Save category'}
        </Button>
      </div>
      {result.isError && (
        <p className="field-error" role="alert">
          The category couldn’t be saved. Your last confirmed category is{' '}
          {categoryNames[transaction.category]}. Try again.
        </p>
      )}
    </form>
  );
}
