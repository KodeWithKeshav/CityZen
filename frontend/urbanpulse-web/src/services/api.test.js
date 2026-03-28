import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeApiCall, authStorage } from './api';

describe('API Service', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });

  describe('makeApiCall', () => {
    it('makes standard fetch request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { foo: 'bar' } })
      });
      
      const res = await makeApiCall('http://localhost:3001/test');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/test', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(res.data.foo).toBe('bar');
    });

    it('adds authorization header if token exists', async () => {
      authStorage.save('fake-token', { id: 1 });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await makeApiCall('http://localhost:3001/protected');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/protected', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-token'
        }
      });
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' })
      });

      await expect(makeApiCall('http://localhost:3001/error')).rejects.toThrow('Bad Request');
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
