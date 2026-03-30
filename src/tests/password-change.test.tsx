import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SettingsPage } from '../pages/Settings';

// --- Mocks ---
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockUpdatePassword = vi.fn();
const mockNavigate = vi.fn();
const mockResetWalkthrough = vi.fn();

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: { email: 'test@example.com' },
      signIn: mockSignIn,
      signOut: mockSignOut,
      updatePassword: mockUpdatePassword,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn((selector) => {
    const state = { resetWalkthrough: mockResetWalkthrough };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../hooks/useSessions', () => ({
  useDeletedSessions: () => [],
}));

vi.mock('../db/sessions', () => ({
  restoreSession: vi.fn(),
  permanentlyDeleteSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { walkthrough_completed: true }, error: null })) })) })) })),
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-id' } }, error: null })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}));

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Settings - Account Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockUpdatePassword.mockReset();
  });

  it('renders "Account" section header', () => {
    renderSettings();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders "Change Password" expandable row in collapsed state', () => {
    renderSettings();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    // Should NOT show the form fields when collapsed
    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
  });

  it('clicking "Change Password" row expands to show 3 password fields and 2 buttons', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));

    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    expect(screen.getByText('Update Password')).toBeInTheDocument();
    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
  });

  it('shows "Passwords do not match" error when new password and confirm password differ', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));
    await user.type(screen.getByLabelText('Current Password'), 'oldpass');
    await user.type(screen.getByLabelText('New Password'), 'newpass1');
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass2');
    await user.click(screen.getByText('Update Password'));

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
  });

  it('shows "Password must be at least 6 characters" when new password is under 6 chars', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));
    await user.type(screen.getByLabelText('Current Password'), 'oldpass');
    await user.type(screen.getByLabelText('New Password'), '12345');
    await user.type(screen.getByLabelText('Confirm New Password'), '12345');
    await user.click(screen.getByText('Update Password'));

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters');
  });

  it('calls signIn to verify current password before updating', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    mockUpdatePassword.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));
    await user.type(screen.getByLabelText('Current Password'), 'myoldpass');
    await user.type(screen.getByLabelText('New Password'), 'mynewpass');
    await user.type(screen.getByLabelText('Confirm New Password'), 'mynewpass');
    await user.click(screen.getByText('Update Password'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'myoldpass');
    });
  });

  it('shows "Current password is incorrect" when signIn returns error', async () => {
    mockSignIn.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));
    await user.type(screen.getByLabelText('Current Password'), 'wrongpass');
    await user.type(screen.getByLabelText('New Password'), 'newpass123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass123');
    await user.click(screen.getByText('Update Password'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect');
    });
  });

  it('calls updatePassword with new password after successful verification and shows success message', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    mockUpdatePassword.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Change Password'));
    await user.type(screen.getByLabelText('Current Password'), 'myoldpass');
    await user.type(screen.getByLabelText('New Password'), 'mynewpass');
    await user.type(screen.getByLabelText('Confirm New Password'), 'mynewpass');
    await user.click(screen.getByText('Update Password'));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('mynewpass');
    });
    expect(screen.getByText('Password updated successfully')).toBeInTheDocument();
  });

  it('renders "Sign Out" button in Actions section', () => {
    renderSettings();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('clicking Sign Out opens ConfirmDialog with correct copy', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Sign Out'));

    expect(screen.getByText('Sign out of your account? Your local data will be preserved.')).toBeInTheDocument();
    // Check that the dialog has "Stay Signed In" cancel button
    expect(screen.getByText('Stay Signed In')).toBeInTheDocument();
  });

  it('confirming Sign Out calls signOut and navigates to /login', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderSettings();

    // Click Sign Out button to open dialog
    await user.click(screen.getByText('Sign Out'));

    // There will be two elements with "Sign Out" text: the button and the dialog title and the confirm button
    // The confirm button in the dialog is the one we need to click
    const signOutButtons = screen.getAllByText('Sign Out');
    // The confirm button in the dialog (last one)
    const confirmButton = signOutButtons[signOutButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
