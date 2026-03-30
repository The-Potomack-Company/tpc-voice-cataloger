import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginPage } from '../pages/Login';

// --- Mocks ---
const { mockSignIn, mockNavigate } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (state: { signIn: typeof mockSignIn }) => unknown) => {
    const state = { signIn: mockSignIn };
    return selector(state);
  }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "TPC Catalog" heading', () => {
    renderLogin();
    expect(screen.getByText('TPC Catalog')).toBeInTheDocument();
  });

  it('renders subtitle "Speech-to-catalog tool for auctioneers"', () => {
    renderLogin();
    expect(
      screen.getByText('Speech-to-catalog tool for auctioneers'),
    ).toBeInTheDocument();
  });

  it('renders email input with label "Email" and placeholder "you@example.com"', () => {
    renderLogin();
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('placeholder', 'you@example.com');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('renders password input with type="password" and label "Password"', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('renders "Sign In" submit button', () => {
    renderLogin();
    const button = screen.getByRole('button', { name: 'Sign In' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('calls signIn with entered email and password on form submit', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });
  });

  it('disables Sign In button and shows spinner during submission', async () => {
    // signIn never resolves -- stays in loading state
    mockSignIn.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'pass');
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    // Spinner should be visible (animate-spin class on a child element)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays error message from signIn failure below the button', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'bad@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Invalid login credentials');
    });
  });

  it('clears error message on the next form submission', async () => {
    // First submit: error
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'bad@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Second submit: success (error should clear)
    mockSignIn.mockResolvedValueOnce({ error: null });
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('navigates to "/" on successful sign in', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
