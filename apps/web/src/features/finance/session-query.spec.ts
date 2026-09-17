import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import { withDemoSession } from './session-query';

function context(controller = new AbortController()): BaseQueryApi {
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    dispatch: jest.fn(),
    getState: () => ({}),
    extra: undefined,
    endpoint: 'test',
    type: 'query',
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const unauthorized = () => Response.json({ message: 'Session expired' }, { status: 401 });
afterEach(() => jest.restoreAllMocks());

test('one renewal handles simultaneous and late unauthorized responses in the same store', async () => {
  const renewed = deferred<Response>();
  const late = deferred<Response>();
  const started = deferred<void>();
  let authorized = false;
  let sessions = 0;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === '/session/demo') {
      sessions++;
      started.resolve();
      return renewed.promise;
    }
    if (authorized) return Response.json({ path });
    if (path === '/late') return late.promise;
    return unauthorized();
  });
  const query = withDemoSession(fetchBaseQuery({ baseUrl: 'http://localhost:3001' }));
  const api = context();
  const calls = ['/accounts', '/cards', '/late'].map((path) =>
    Promise.resolve(query(path, api, {})),
  );
  await started.promise;
  authorized = true;
  renewed.resolve(Response.json({ mode: 'demo' }));
  await calls[0];
  late.resolve(unauthorized());
  const results = await Promise.all(calls);
  expect(sessions).toBe(1);
  expect(results.every((result) => !result.error)).toBe(true);
});

test('failed renewal preserves the original error and a later request can recover', async () => {
  let failRenewal = true;
  let authorized = false;
  jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (new URL((input as Request).url).pathname === '/session/demo') {
      if (failRenewal) return Promise.resolve(Response.json({}, { status: 503 }));
      authorized = true;
      return Promise.resolve(Response.json({ mode: 'demo' }));
    }
    return Promise.resolve(authorized ? Response.json({ ok: true }) : unauthorized());
  });
  const query = withDemoSession(fetchBaseQuery({ baseUrl: 'http://localhost:3001' }));
  const api = context();
  expect((await query('/cards', api, {})).error?.status).toBe(401);
  failRenewal = false;
  expect((await query('/cards', api, {})).data).toEqual({ ok: true });
});

test('renewal preserves the exact financial request', async () => {
  const renewed = deferred<Response>();
  const started = deferred<void>();
  const requests: { key: string | null; body: string; method: string }[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === '/session/demo') {
      started.resolve();
      return renewed.promise;
    }
    requests.push({
      key: request.headers.get('Idempotency-Key'),
      body: await request.text(),
      method: request.method,
    });
    return requests.length === 1 ? unauthorized() : Response.json({ id: 'same-transfer' });
  });
  const query = withDemoSession(fetchBaseQuery({ baseUrl: 'http://localhost:3001' }));
  const controller = new AbortController();
  const operation = query(
    {
      url: '/transfers',
      method: 'POST',
      headers: { 'Idempotency-Key': 'immutable-key' },
      body: { quoteId: 'reviewed-quote', note: 'Exact intent' },
    },
    context(controller),
    {},
  );
  await started.promise;
  renewed.resolve(Response.json({ mode: 'demo' }));
  await operation;
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('cancelling the initiating screen does not cancel renewal for another screen', async () => {
  const renewed = deferred<Response>();
  const started = deferred<void>();
  let authorized = false;
  let renewalSignal: AbortSignal | undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === '/session/demo') {
      renewalSignal = request.signal;
      started.resolve();
      return renewed.promise;
    }
    return authorized ? Response.json({ ok: true }) : unauthorized();
  });
  const query = withDemoSession(fetchBaseQuery({ baseUrl: 'http://localhost:3001' }));
  const controller = new AbortController();
  const firstApi = context(controller);
  const first = query('/cards', firstApi, {});
  await started.promise;
  const second = query('/accounts', { ...context(), dispatch: firstApi.dispatch }, {});
  controller.abort();
  expect(renewalSignal?.aborted).toBe(false);
  authorized = true;
  renewed.resolve(Response.json({ mode: 'demo' }));
  expect((await first).error?.status).toBe(401);
  expect((await second).data).toEqual({ ok: true });
});

test('independent stores have independent renewal state', async () => {
  let sessions = 0;
  jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (new URL((input as Request).url).pathname === '/session/demo') {
      sessions++;
      return Promise.resolve(Response.json({ mode: 'demo' }));
    }
    return Promise.resolve(unauthorized());
  });
  const query = withDemoSession(fetchBaseQuery({ baseUrl: 'http://localhost:3001' }));
  await Promise.all([query('/cards', context(), {}), query('/cards', context(), {})]);
  expect(sessions).toBe(2);
});
