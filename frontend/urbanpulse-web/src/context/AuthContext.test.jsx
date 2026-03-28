import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { authStorage } from '../services/api';

vi.mock('../services/api', () => ({
  authStorage: {
    getUser: vi.fn(),
    getToken: vi.fn(),
    save: vi.fn(),
    clear: vi.fn()
  }
}));

const TestComponent = () => {
  const { user, login, logout, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.name : 'No User'}</div>
      <button onClick={() => login('mock-token', { name: 'Test User' })}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with no user if storage is empty', () => {
    authStorage.getUser.mockReturnValue(null);
    authStorage.getToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('No User');
  });

  it('initializes with user if storage has data', () => {
    authStorage.getUser.mockReturnValue({ name: 'Existing User' });
    authStorage.getToken.mockReturnValue('valid-token');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('Existing User');
  });

  it('handles login manually', () => {
    authStorage.getUser.mockReturnValue(null);
    authStorage.getToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('No User');

    act(() => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('Test User');
    expect(authStorage.save).toHaveBeenCalledWith('mock-token', { name: 'Test User' });
  });

  it('handles logout manually', () => {
    authStorage.getUser.mockReturnValue({ name: 'Bob' });
    authStorage.getToken.mockReturnValue('bob-token');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('Bob');

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('No User');
    expect(authStorage.clear).toHaveBeenCalled();
  });
});
