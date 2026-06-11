import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AdminRouteGuard } from '../components/AdminRouteGuard';

const { mockUseUserRole } = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
}));

vi.mock('../hooks/useUserRole', () => ({
  useUserRole: mockUseUserRole,
}));

describe('AdminRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Outlet when user profile has role admin', async () => {
    mockUseUserRole.mockReturnValue({ role: 'admin', loading: false });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Admin Content')).toBeInTheDocument());
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('redirects to / when user profile has role specialist', async () => {
    mockUseUserRole.mockReturnValue({ role: 'specialist', loading: false });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
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
    mockUseUserRole.mockReturnValue({ role: null, loading: true });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
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
