import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeApiCall, authStorage } from './api';

describe('API Service', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });

  // makeApiCall() sniffs the response's content-type header before parsing
  // the body (src/services/api.js), so every mocked fetch response below
  // needs a `headers.get()` - a mock missing it throws a TypeError, which
  // makeApiCall's own catch block then reports as a generic connectivity
  // error, masking the real failure. Older versions of these tests predated
  // that content-type check and omitted `headers` entirely.
  const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });

  describe('makeApiCall', () => {
    it('makes standard fetch request', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { foo: 'bar' } }));

      const res = await makeApiCall('http://localhost:3001/test');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/test', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(res.data.foo).toBe('bar');
    });

    it('adds authorization header if token exists', async () => {
      authStorage.save('fake-token', { id: 1 });
      global.fetch.mockResolvedValueOnce(jsonResponse({ success: true }));

      await makeApiCall('http://localhost:3001/protected');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/protected', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-token'
        }
      });
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse({ message: 'Bad Request' }, { ok: false, status: 400 }));

      await expect(makeApiCall('http://localhost:3001/error')).rejects.toThrow('Bad Request');
    });

    it('falls back to a plain-text body when the response is not JSON (boundary case)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        headers: { get: () => 'text/plain' },
        text: async () => 'Bad Gateway',
      });
      await expect(makeApiCall('http://localhost:3001/down')).rejects.toThrow('Bad Gateway');
    });

    it('reports a connectivity error (not a raw TypeError) when fetch itself fails (boundary/error case)', async () => {
      global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(makeApiCall('http://localhost:3001/unreachable')).rejects.toThrow(/unable to reach the server/i);
    });
  });

  describe('authStorage', () => {
    it('saves and retrieves token and user data', () => {
      authStorage.save('token123', { name: 'admin' });
      expect(authStorage.getToken()).toBe('token123');
      expect(authStorage.getUser()).toEqual({ name: 'admin' });
      expect(authStorage.isLoggedIn()).toBe(true);
    });

    it('clears storage correctly', () => {
      authStorage.save('token123', { name: 'admin' });
      authStorage.clear();
      expect(authStorage.getToken()).toBeNull();
      expect(authStorage.getUser()).toBeNull();
      expect(authStorage.isLoggedIn()).toBe(false);
    });
  });
});
