import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Welcome from './Welcome';
import { BrowserRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Welcome Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // IntersectionObserver isn't available in test environment
    window.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const renderComponent = () => render(<BrowserRouter><Welcome /></BrowserRouter>);

  it('renders standard hero headings', () => {
    renderComponent();
    expect(screen.getByText(/Your Voice./i)).toBeInTheDocument();
  });

  it('navigates to login when Sign In buttons are clicked', () => {
    renderComponent();
    const loginButtons = screen.getAllByRole('button', { name: /Sign In|Admin Portal/i });
    
    expect(loginButtons.length).toBeGreaterThan(0);
    fireEvent.click(loginButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to citizen signup when Get Started buttons are clicked', () => {
    renderComponent();
    const signupButtons = screen.getAllByRole('button', { name: /Get Started|Report an Issue/i });
    
    expect(signupButtons.length).toBeGreaterThan(0);
    fireEvent.click(signupButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/citizen/signup');
  });

  it('renders features section', () => {
    renderComponent();
    expect(screen.getByText('AI-Powered Validation')).toBeInTheDocument();
    expect(screen.getByText('Multilingual Support')).toBeInTheDocument();
    expect(screen.getByText('Community Voting')).toBeInTheDocument();
  });

  it('renders stats', () => {
    renderComponent();
    expect(screen.getByText('Languages supported')).toBeInTheDocument();
    expect(screen.getByText('AI services integrated')).toBeInTheDocument();
    expect(screen.getByText('Resolution workflow')).toBeInTheDocument();
  });
});
