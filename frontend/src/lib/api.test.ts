import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiPost, apiUpload } from './api';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(fn: FetchLike) {
  vi.stubGlobal('fetch', fn);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('unwraps a { data } envelope', async () => {
    stubFetch(async () => json(200, { success: true, data: { id: 'x' } }));
    const res = await apiFetch<{ id: string }>('/anything');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ id: 'x' });
  });

  it('unwraps a bare array body', async () => {
    stubFetch(async () => json(200, [{ id: 'a' }, { id: 'b' }]));
    const res = await apiFetch<{ id: string }[]>('/anything');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toHaveLength(2);
  });

  it('prefers the server message for 4xx errors', async () => {
    stubFetch(async () => json(403, { success: false, error: { code: 'FORBIDDEN', message: 'Nope' } }));
    const res = await apiFetch('/anything');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe('Nope');
      expect(res.code).toBe('FORBIDDEN');
    }
  });

  it('falls back to a friendly message for 401 without a server message', async () => {
    stubFetch(async () => json(401, { success: false, error: { code: 'UNAUTHORIZED' } }));
    const res = await apiFetch('/anything');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe('Please log in to continue.');
  });

  it('uses the friendly fallback for server errors without a message', async () => {
    stubFetch(async () => json(500, { error: { code: 'INTERNAL_ERROR' } }));
    const res = await apiFetch('/anything');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain('Something went wrong');
  });

  it('returns a friendly message when the network fails', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await apiFetch<unknown>('/anything');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(0);
      expect(res.message).toBe("We're having trouble connecting right now. Please try again.");
    }
  });
});

describe('apiPost / apiUpload', () => {
  it('apiPost sends a JSON body and credentials', async () => {
    let captured: RequestInit | undefined;
    stubFetch(async (_input, init) => {
      captured = init;
      return json(201, { data: { ok: true } });
    });
    const res = await apiPost('/things', { name: 'widget' });
    expect(res.ok).toBe(true);
    expect(captured?.method).toBe('POST');
    expect(captured?.credentials).toBe('include');
    expect((captured?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(captured?.body).toBe('{"name":"widget"}');
  });

  it('apiUpload does not set a JSON content type for FormData', async () => {
    let captured: RequestInit | undefined;
    stubFetch(async (_input, init) => {
      captured = init;
      return json(200, { data: { url: '/uploads/x.png' } });
    });
    const form = new FormData();
    form.append('field', 'value');
    const res = await apiUpload('/upload', form);
    expect(res.ok).toBe(true);
    expect((captured?.headers as Record<string, string> | undefined)?.['Content-Type']).toBeUndefined();
    expect(captured?.body).toBe(form);
  });
});