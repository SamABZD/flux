import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReviewStep } from './review-step';
import { quoteFixture, recipientFixture } from '../../../test/transfer-fixtures';
import { accountsFixture } from '../../../test/finance-fixtures';
test('a quote expires with confirmation disabled, one status message and an explicit refresh', () => {
  jest.useFakeTimers();
  const refresh = jest.fn(),
    confirm = jest.fn();
  const q = quoteFixture();
  const { unmount } = render(
    <ReviewStep
      quote={q}
      recipient={recipientFixture}
      account={accountsFixture.items[0]}
      destinationName="Euro account"
      note="Rent"
      busy={false}
      onConfirm={confirm}
      onRefresh={refresh}
      onEdit={jest.fn()}
    />,
  );
  expect(screen.getByText('Rate guaranteed for 00:45')).toHaveAttribute('aria-live', 'off');
  expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeEnabled();
  act(() => jest.advanceTimersByTime(45000));
  expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Get a fresh quote');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  unmount();
  jest.useRealTimers();
});
