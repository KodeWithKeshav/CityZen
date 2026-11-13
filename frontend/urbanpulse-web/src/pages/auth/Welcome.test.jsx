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
    // The hero <h1> is the brand mark ("CITYZEN"); it appears both in the
    // navbar and the hero section, so assert there are at least two.
    expect(screen.getAllByText('CITYZEN').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Institutional Portal')).toBeInTheDocument();
  });

  it('navigates to login when Sign In buttons are clicked', () => {
    renderComponent();
    const loginButtons = screen.getAllByRole('button', { name: /Sign In|Admin Access/i });
    
    expect(loginButtons.length).toBeGreaterThan(0);
    fireEvent.click(loginButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to citizen signup when Get Started buttons are clicked', () => {
    renderComponent();
    const signupButtons = screen.getAllByRole('button', { name: /Get Started|Citizen Portal/i });
    
    expect(signupButtons.length).toBeGreaterThan(0);
    fireEvent.click(signupButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/citizen/signup');
  });

  it('renders features section', () => {
    renderComponent();
    expect(screen.getByText('AI-POWERED VALIDATION')).toBeInTheDocument();
    expect(screen.getByText('MULTILINGUAL SUPPORT')).toBeInTheDocument();
    expect(screen.getByText('COMMUNITY VOTING')).toBeInTheDocument();
    expect(screen.getByText('LOCATION PRIORITY')).toBeInTheDocument();
    expect(screen.getByText('TRANSPARENCY METRICS')).toBeInTheDocument();
    expect(screen.getByText('HEAT MAP INTELLIGENCE')).toBeInTheDocument();
  });

  it('renders stats', () => {
    renderComponent();
    expect(screen.getByText('LANGUAGES')).toBeInTheDocument();
    expect(screen.getByText('AI SERVICES')).toBeInTheDocument();
    expect(screen.getByText('WORKFLOW')).toBeInTheDocument();
    expect(screen.getByText('OPEN SOURCE')).toBeInTheDocument();
    // The stat values themselves (6 languages, 5 AI services, etc.)
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3-STAGE')).toBeInTheDocument();
  });
});
