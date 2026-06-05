import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';

// --- Mocks ---
const { mockUseAuthStore, mockUseSessionStore, mockScopeSessionStore, mockScopeUIStore, mockUseDataMigration, mockProcessWriteAheadQueue, mockFetchSessions } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockUseSessionStore: vi.fn(),
  mockScopeSessionStore: vi.fn(),
  mockScopeUIStore: vi.fn(),
  mockUseDataMigration: vi.fn(),
  mockProcessWriteAheadQueue: vi.fn(),
  mockFetchSessions: vi.fn(),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: mockUseSessionStore,
  scopeSessionStore: mockScopeSessionStore,
}));

vi.mock('../stores/uiStore', () => ({
  scopeUIStore: mockScopeUIStore,
}));

vi.mock('../hooks/useDataMigration', () => ({
  useDataMigration: mockUseDataMigration,
}));

vi.mock('../hooks/useWriteAheadQueue', () => ({
  processWriteAheadQueue: mockProcessWriteAheadQueue,
}));

vi.mock('../components/MigrationSplash', () => ({
  MigrationSplash: () => <div data-testid="migration-splash">Migration Splash</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockProcessWriteAheadQueue.mockResolvedValue(undefined);
  mockUseSessionStore.mockImplementation((selector: unknown) =>
    typeof selector === 'function'
      ? (selector as (s: { fetchSessions: ReturnType<typeof vi.fn> }) => unknown)({ fetchSessions: mockFetchSessions })
      : { fetchSessions: mockFetchSessions }
  );
  mockUseDataMigration.mockReturnValue({
    state: 'not-needed',
    current: 0,
    total: 0,
    migrated: 0,
    skipped: 0,
    retry: vi.fn(),
  });
});

describe('ProtectedRoute', () => {
  it('renders Outlet when session exists and loading is false', () => {
    mockUseAuthStore.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'test-user-id' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('renders Navigate to /login when session is null and loading is false', () => {
    mockUseAuthStore.mockReturnValue({
      session: null,
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders loading spinner when loading is true', () => {
    mockUseAuthStore.mockReturnValue({
      session: null,
      user: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('shows migration splash when migration is in-progress', () => {
    mockUseAuthStore.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'test-user-id' },
      loading: false,
    });

    mockUseDataMigration.mockReturnValue({
      state: 'in-progress',
      current: 3,
      total: 10,
      migrated: 3,
      skipped: 0,
      retry: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('migration-splash')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('WR-01: drains queue and fetches sessions on partial migration state', async () => {
    mockUseAuthStore.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'test-user-id' },
      loading: false,
    });

    mockUseDataMigration.mockReturnValue({
      state: 'partial',
      current: 7,
      total: 10,
      migrated: 7,
      skipped: 3,
      retry: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockProcessWriteAheadQueue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockFetchSessions).toHaveBeenCalledTimes(1));
  });

  it('WR-01: does NOT drain/fetch on error migration state', async () => {
    mockUseAuthStore.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'test-user-id' },
      loading: false,
    });

    mockUseDataMigration.mockReturnValue({
      state: 'error',
      current: 2,
      total: 10,
      migrated: 2,
      skipped: 0,
      retry: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(mockProcessWriteAheadQueue).not.toHaveBeenCalled();
    expect(mockFetchSessions).not.toHaveBeenCalled();
  });
});
