import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockOnAuthStateChange = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      updateUser: mockUpdateUser,
    },
  },
}));

import { useAuthStore } from '../stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests
    useAuthStore.setState({
      session: null,
      user: null,
      loading: true,
    });
  });

  it('has initial state with loading=true, session=null, user=null', () => {
    const state = useAuthStore.getState();
    expect(state.loading).toBe(true);
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });

  it('initialize() subscribes to onAuthStateChange and sets loading=false after INITIAL_SESSION event', () => {
    const mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const unsubscribe = useAuthStore.getState().initialize();

    expect(mockOnAuthStateChange).toHaveBeenCalledOnce();

    // Capture the callback
    const callback = mockOnAuthStateChange.mock.calls[0][0];
    const mockSession = {
      access_token: 'test-token',
      user: { id: 'user-123', email: 'test@example.com' },
    };

    // Simulate INITIAL_SESSION event
    callback('INITIAL_SESSION', mockSession);

    const state = useAuthStore.getState();
    expect(state.loading).toBe(false);
    expect(state.session).toEqual(mockSession);
    expect(state.user).toEqual(mockSession.user);

    // Verify unsubscribe function works
    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('onAuthStateChange callback sets session and user from event data', () => {
    const mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    useAuthStore.getState().initialize();
    const callback = mockOnAuthStateChange.mock.calls[0][0];

    // Simulate SIGNED_IN event with session
    const mockSession = {
      access_token: 'new-token',
      user: { id: 'user-456', email: 'other@example.com' },
    };
    callback('SIGNED_IN', mockSession);

    const state = useAuthStore.getState();
    expect(state.session).toEqual(mockSession);
    expect(state.user).toEqual(mockSession.user);
    expect(state.loading).toBe(false);

    // Simulate SIGNED_OUT event with null session
    callback('SIGNED_OUT', null);

    const stateAfterSignOut = useAuthStore.getState();
    expect(stateAfterSignOut.session).toBeNull();
    expect(stateAfterSignOut.user).toBeNull();
    expect(stateAfterSignOut.loading).toBe(false);
  });

  it('signIn(email, password) calls supabase.auth.signInWithPassword and returns { error: null } on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });

    const result = await useAuthStore.getState().signIn('test@example.com', 'password123');

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result).toEqual({ error: null });
  });

  it('signIn(email, password) returns { error } on failure without throwing', async () => {
    const mockError = new Error('Invalid login credentials');
    mockSignInWithPassword.mockResolvedValue({ data: null, error: mockError });

    const result = await useAuthStore.getState().signIn('test@example.com', 'wrong-password');

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'wrong-password',
    });
    expect(result.error).toEqual(mockError);
  });

  it('signOut() calls supabase.auth.signOut with { scope: "local" }', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('updatePassword(newPassword) calls supabase.auth.updateUser({ password: newPassword })', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await useAuthStore.getState().updatePassword('new-secure-password');

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-secure-password' });
    expect(result).toEqual({ error: null });
  });
});
