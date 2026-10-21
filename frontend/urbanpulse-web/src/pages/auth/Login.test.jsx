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
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows error if fields are empty on submit', async () => {
    renderWithRouter(<Login />);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
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

    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(api.makeApiCall).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });
      expect(mockLogin).toHaveBeenCalledWith('fake-token', { fullName: 'John Doe', userType: 'citizen' });
    });
  });
});
