import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';

// --- Mocks ---
const { mockUseAuthStore, mockUseSessionStore, mockScopeSessionStore, mockScopeUIStore, mockUseDataMigration } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockUseSessionStore: vi.fn(),
  mockScopeSessionStore: vi.fn(),
  mockScopeUIStore: vi.fn(),
  mockUseDataMigration: vi.fn(),
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

vi.mock('../components/MigrationSplash', () => ({
  MigrationSplash: () => <div data-testid="migration-splash">Migration Splash</div>,
}));

beforeEach(() => {
  mockUseSessionStore.mockImplementation((selector: unknown) =>
    typeof selector === 'function'
      ? (selector as (s: { fetchSessions: ReturnType<typeof vi.fn> }) => unknown)({ fetchSessions: vi.fn() })
      : { fetchSessions: vi.fn() }
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
});
