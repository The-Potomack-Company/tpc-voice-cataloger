import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

const { mockIsFirebaseAuthBackend, mockEnsureFreshSession } = vi.hoisted(() => ({
  mockIsFirebaseAuthBackend: vi.fn(),
  mockEnsureFreshSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('../lib/authBackend', () => ({
  isFirebaseAuthBackend: mockIsFirebaseAuthBackend,
}));

vi.mock('../lib/authGuard', () => ({
  ensureFreshSession: mockEnsureFreshSession,
}));

import {
  createSpecialistAccount,
  toggleAccountActive,
  listAccounts,
  seedProfiles,
  type Account,
} from '../services/adminApi';

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFirebaseAuthBackend.mockReturnValue(false);
    mockEnsureFreshSession.mockResolvedValue('firebase-token');
    vi.stubEnv('VITE_CATALOGER_API_URL', 'https://cataloger-api.example.com');
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

    it('calls cataloger-api in Firebase mode', async () => {
      mockIsFirebaseAuthBackend.mockReturnValue(true);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { id: 'firebase-1', email: 'specialist@potomackco.com' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await createSpecialistAccount({
        email: 'specialist@potomackco.com',
        password: 'temp-pass-123',
        displayName: 'Jane Doe',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cataloger-api.example.com/admin/create-user',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ authorization: 'Bearer firebase-token' }),
        }),
      );
      expect(result.user.id).toBe('firebase-1');
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

    it('calls cataloger-api in Firebase mode', async () => {
      mockIsFirebaseAuthBackend.mockReturnValue(true);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(toggleAccountActive('user-456', false)).resolves.toEqual({ success: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cataloger-api.example.com/admin/update-user',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ userId: 'user-456', activate: false }),
        }),
      );
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

    it('lists users through cataloger-api in Firebase mode', async () => {
      mockIsFirebaseAuthBackend.mockReturnValue(true);
      const mockAccounts: Account[] = [{
        id: 'firebase-1',
        email: 'admin@potomackco.com',
        display_name: 'Admin',
        role: 'admin',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      }];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accounts: mockAccounts }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(listAccounts()).resolves.toEqual(mockAccounts);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cataloger-api.example.com/admin/list-users',
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: 'Bearer firebase-token' }),
        }),
      );
    });
  });

  describe('seedProfiles', () => {
    it('calls cataloger-api batch create-user in Firebase mode', async () => {
      mockIsFirebaseAuthBackend.mockReturnValue(true);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          users: [
            {
              id: 'manager-1',
              email: 'manager@potomackco.com',
              role: 'manager',
              created: false,
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(seedProfiles([
        {
          email: 'manager@potomackco.com',
          displayName: 'Manny Manager',
          role: 'manager',
        },
      ])).resolves.toEqual([
        {
          id: 'manager-1',
          email: 'manager@potomackco.com',
          role: 'manager',
          created: false,
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cataloger-api.example.com/admin/create-user',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            users: [
              {
                email: 'manager@potomackco.com',
                displayName: 'Manny Manager',
                role: 'manager',
              },
            ],
          }),
        }),
      );
    });
  });
});
