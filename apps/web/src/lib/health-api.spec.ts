import { getHealth } from './health-api';

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
beforeEach(() => {
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  fetchMock.mockReset();
});

test('sends the health request with a cancellation signal', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ status: 'ok' }),
  } as Response);
  const controller = new AbortController();
  await expect(getHealth(controller.signal)).resolves.toEqual({ status: 'ok' });
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/health', {
    headers: { Accept: 'application/json' },
    signal: controller.signal,
  });
});

test('rejects unsuccessful HTTP responses', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(getHealth()).rejects.toThrow('Health request failed (503).');
});

test.each([null, {}, { status: 'down' }, 'ok'])(
  'rejects malformed health response %p',
  async (body: unknown) => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(body) } as Response);
    await expect(getHealth()).rejects.toThrow('unexpected health response');
  },
);
