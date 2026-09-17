import type { BaseQueryApi, fetchBaseQuery } from '@reduxjs/toolkit/query';

type RequestQuery = ReturnType<typeof fetchBaseQuery>;
type Result = Awaited<ReturnType<RequestQuery>>;

export function withDemoSession(request: RequestQuery): RequestQuery {
  const sessions = new WeakMap<
    BaseQueryApi['dispatch'],
    { generation: number; pending: Promise<Result> | null }
  >();
  return async (args, api, options) => {
    let session = sessions.get(api.dispatch);
    if (!session) {
      session = { generation: 0, pending: null };
      sessions.set(api.dispatch, session);
    }
    if (session.pending) await session.pending;
    const generation = session.generation;
    const result = await request(args, api, options);
    if (result.error?.status !== 401 || api.signal.aborted) return result;
    if (session.generation === generation) {
      if (!session.pending) {
        const current = session;
        current.pending = (async () => {
          try {
            const renewed = await request(
              { url: '/session/demo', method: 'POST' },
              { ...api, signal: new AbortController().signal },
              options,
            );
            if (!renewed.error) current.generation++;
            return renewed;
          } finally {
            current.pending = null;
          }
        })();
      }
      const renewed = await session.pending;
      if (renewed?.error) return result;
    }

    if (api.signal.aborted) return result;
    return request(args, api, options);
  };
}
