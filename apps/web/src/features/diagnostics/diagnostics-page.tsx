import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { getHealth } from '@/lib/health-api';
import { checkCompleted } from './diagnostics-slice';
import { PageHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Link } from 'react-router';

type Connection = 'idle' | 'checking' | 'connected' | 'error';

export function DiagnosticsPage() {
  const dispatch = useAppDispatch();
  const completedChecks = useAppSelector((state) => state.diagnostics.completedChecks);
  const [connection, setConnection] = useState<Connection>('idle');
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function checkConnection() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setConnection('checking');
    try {
      await getHealth(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
      if (!controller.signal.aborted) {
        dispatch(checkCompleted());
        setConnection('connected');
      }
    } catch {
      if (!controller.signal.aborted) setConnection('error');
    }
  }

  return (
    <>
      <PageHeader
        title="Foundation diagnostics"
        description="Check the connection behind the interface."
      />
      <section className="diagnostics-panel" aria-label="API connection">
        <p>
          Verify the browser can reach the API. Successful checks are counted in Redux for this
          session.
        </p>
        <Button onClick={checkConnection} loading={connection === 'checking'}>
          {connection === 'checking' ? 'Checking…' : 'Check API connection'}
        </Button>
        <p role="status" aria-live="polite">
          {connection === 'idle' && 'Ready to check.'}
          {connection === 'checking' && 'Contacting the API…'}
          {connection === 'connected' && 'API connected · status: ok'}
          {connection === 'error' &&
            'Could not reach the API. Check that the backend is running, then retry.'}
        </p>
        <p>
          Successful checks: <strong>{completedChecks}</strong>
        </p>
      </section>
      <section className="diagnostics-panel" aria-label="Demo Tools">
        <h2>Demo Tools</h2>
        <p>
          Exercise card authorization, security controls, FX funding and refunds with fictional
          money.
        </p>
        <Link className="button button--secondary" to="/demo/card-payments">
          Open card payment simulator
        </Link>
      </section>
    </>
  );
}
