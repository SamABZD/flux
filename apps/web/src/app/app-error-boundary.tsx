import { Component } from 'react';
import type { ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-main">
        <div className="page-header">
          <div>
            <h1 tabIndex={-1} ref={(heading) => heading?.focus()}>
              This page couldn’t load
            </h1>
            <p role="alert">
              Reload to try again. If you were confirming a payment, check its status after
              reloading before starting another.
            </p>
          </div>
        </div>
        <a className="button button--primary" href={window.location.href}>
          Reload page
        </a>{' '}
        <a className="text-link" href="/home">
          Return home
        </a>
      </main>
    );
  }
}
