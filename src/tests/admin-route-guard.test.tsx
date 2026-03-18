import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AdminRouteGuard } from '../components/AdminRouteGuard';

// --- Mocks ---
const { mockUseAuthStore, mockFrom } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('AdminRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Outlet when user profile has role admin', async () => {
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: { id: 'admin-1' } })
    );

    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('redirects to / when user profile has role specialist', async () => {
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: { id: 'specialist-1' } })
    );

    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'specialist' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('returns null (loading) when profile is not yet loaded', () => {
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: { id: 'user-1' } })
    );

    // Mock a never-resolving promise to keep loading state
    const mockSingle = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { container } = render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // While loading, neither content nor redirect should be rendered
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });
});
