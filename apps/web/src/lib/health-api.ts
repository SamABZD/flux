export interface HealthResponse {
  status: 'ok';
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const healthUrl = __API_BASE_URL__.startsWith('/') ? '/health' : `${__API_BASE_URL__}/health`;
  const response = await fetch(healthUrl, {
    headers: { Accept: 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`Health request failed (${response.status}).`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ok') {
    throw new Error('The API returned an unexpected health response.');
  }
  return { status: 'ok' };
}
