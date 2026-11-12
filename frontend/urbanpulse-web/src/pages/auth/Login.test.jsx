import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import { BrowserRouter } from 'react-router-dom';
import * as AuthContext from '../../context/AuthContext';
import * as api from '../../services/api';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../services/api', () => ({
  makeApiCall: vi.fn(),
  apiClient: { auth: { login: '/api/auth/login' } }
}));

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Login Component', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    AuthContext.useAuth.mockReturnValue({ login: mockLogin });
  });

  it('renders login form correctly', () => {
    renderWithRouter(<Login />);
    // "AUTHENTICATE SESSION" is this page's actual submit-button copy
    // (a deliberate "institutional portal" theme) - there is no literal
    // "Sign In" text on this page itself.
    expect(screen.getByRole('button', { name: /authenticate session/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your credentials')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
  });

  it('shows error if fields are empty on submit', async () => {
    renderWithRouter(<Login />);
    const submitButton = screen.getByRole('button', { name: /authenticate session/i });

    fireEvent.click(submitButton);

    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Please fill in all fields');
    expect(api.makeApiCall).not.toHaveBeenCalled();
  });

  it('calls login API and authenticates on success', async () => {
    renderWithRouter(<Login />);
    const user = userEvent.setup();

    api.makeApiCall.mockResolvedValueOnce({
      success: true,
      data: { token: 'fake-token', user: { fullName: 'John Doe', userType: 'citizen' } }
    });

    await user.type(screen.getByPlaceholderText('Enter your credentials'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'password123');

    await user.click(screen.getByRole('button', { name: /authenticate session/i }));

    await waitFor(() => {
      expect(api.makeApiCall).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });
      expect(mockLogin).toHaveBeenCalledWith('fake-token', { fullName: 'John Doe', userType: 'citizen' });
    });
  });

  it('shows a disabled, spinner "AUTHENTICATING..." state while the request is in flight (boundary/loading state)', async () => {
    renderWithRouter(<Login />);
    const user = userEvent.setup();
    let resolveLogin;
    api.makeApiCall.mockReturnValueOnce(new Promise((resolve) => { resolveLogin = resolve; }));

    await user.type(screen.getByPlaceholderText('Enter your credentials'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /authenticate session/i }));

    expect(screen.getByText(/authenticating\.\.\./i)).toBeInTheDocument();
    resolveLogin({ success: true, data: { token: 't', user: { fullName: 'X', userType: 'citizen' } } });
  });
});
