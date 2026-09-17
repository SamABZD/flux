import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './app-error-boundary';

test('a route failure provides focused recovery without clearing financial drafts', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const saved = JSON.stringify({ key: 'original-attempt' });
  sessionStorage.setItem('flux.transfer.draft.v1', saved);
  sessionStorage.setItem('flux.card-payment.pending.v1', saved);
  function FailedChunk(): never {
    throw new Error('Loading chunk failed');
  }
  try {
    render(
      <AppErrorBoundary>
        <FailedChunk />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'This page couldn’t load' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('check its status');
    expect(screen.getByRole('link', { name: 'Reload page' })).toHaveAttribute(
      'href',
      window.location.href,
    );
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/home');
    expect(sessionStorage.getItem('flux.transfer.draft.v1')).toBe(saved);
    expect(sessionStorage.getItem('flux.card-payment.pending.v1')).toBe(saved);
  } finally {
    log.mockRestore();
    sessionStorage.clear();
  }
});

test('healthy content renders normally', () => {
  render(
    <AppErrorBoundary>
      <h1>Home</h1>
    </AppErrorBoundary>,
  );
  expect(screen.getByRole('heading', { name: 'Home' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
