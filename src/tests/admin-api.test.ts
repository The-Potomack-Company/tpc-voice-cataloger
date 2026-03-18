import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import {
  createSpecialistAccount,
  toggleAccountActive,
  listAccounts,
} from '../services/adminApi';

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSpecialistAccount', () => {
    it('calls supabase.functions.invoke with admin-create-user and body', async () => {
      const mockUser = { id: 'user-123', email: 'specialist@test.com' };
      mockInvoke.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createSpecialistAccount({
        email: 'specialist@test.com',
        password: 'temp-pass-123',
        displayName: 'Jane Doe',
      });

      expect(mockInvoke).toHaveBeenCalledWith('admin-create-user', {
        body: {
          email: 'specialist@test.com',
          password: 'temp-pass-123',
          displayName: 'Jane Doe',
        },
      });
      expect(result).toEqual({ user: mockUser });
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      await expect(
        createSpecialistAccount({
          email: 'existing@test.com',
          password: 'pass',
          displayName: 'Duplicate',
        })
      ).rejects.toThrow('User already registered');
    });
  });

  describe('toggleAccountActive', () => {
    it('calls supabase.functions.invoke with admin-update-user and body', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await toggleAccountActive('user-456', false);

      expect(mockInvoke).toHaveBeenCalledWith('admin-update-user', {
        body: { userId: 'user-456', activate: false },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Cannot modify your own account' },
      });

      await expect(
        toggleAccountActive('admin-id', false)
      ).rejects.toThrow('Cannot modify your own account');
    });
  });

  describe('listAccounts', () => {
    it('calls supabase.functions.invoke with admin-list-users and returns accounts array', async () => {
      const mockAccounts = [
        {
          id: 'user-1',
          email: 'admin@test.com',
          display_name: 'Admin',
          role: 'admin',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'user-2',
          email: 'specialist@test.com',
          display_name: 'Specialist',
          role: 'specialist',
          is_active: true,
          created_at: '2026-01-02T00:00:00Z',
        },
      ];
      mockInvoke.mockResolvedValue({
        data: { accounts: mockAccounts },
        error: null,
      });

      const result = await listAccounts();

      expect(mockInvoke).toHaveBeenCalledWith('admin-list-users');
      expect(result).toEqual(mockAccounts);
    });
  });
});
