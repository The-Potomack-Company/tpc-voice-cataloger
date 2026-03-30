import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AccountManagementPage } from '../pages/AccountManagement'
import { AccountRow } from '../components/AccountRow'
import type { Account } from '../services/adminApi'

// --- Hoisted mocks ---
const { mockListAccounts, mockCreateSpecialist, mockToggleActive } = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
  mockCreateSpecialist: vi.fn(),
  mockToggleActive: vi.fn(),
}))

vi.mock('../services/adminApi', () => ({
  listAccounts: mockListAccounts,
  createSpecialistAccount: mockCreateSpecialist,
  toggleAccountActive: mockToggleActive,
}))

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { user: { id: 'admin-uuid', email: 'admin@test.com' } }
    return selector ? selector(state) : state
  }),
}))

// Mock data
const mockAccounts: Account[] = [
  {
    id: 'admin-uuid',
    email: 'admin@test.com',
    display_name: 'Admin User',
    role: 'admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'specialist-uuid',
    email: 'specialist@test.com',
    display_name: 'Specialist User',
    role: 'specialist',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'deactivated-uuid',
    email: 'deactivated@test.com',
    display_name: 'Deactivated User',
    role: 'specialist',
    is_active: false,
    created_at: '2026-01-03T00:00:00Z',
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountManagementPage />
    </MemoryRouter>,
  )
}

describe('AccountManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListAccounts.mockResolvedValue([...mockAccounts])
    mockCreateSpecialist.mockResolvedValue({ user: { id: 'new-uuid', email: 'new@test.com' } })
    mockToggleActive.mockResolvedValue({ success: true })
  })

  it('renders loading skeleton when accounts are being fetched', () => {
    // listAccounts never resolves -- stays in loading state
    mockListAccounts.mockImplementation(() => new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })

  it('renders account list with display names, emails, role badges, and status badges', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    expect(screen.getByText('Specialist User')).toBeInTheDocument()
    expect(screen.getByText('specialist@test.com')).toBeInTheDocument()
    expect(screen.getByText('Deactivated User')).toBeInTheDocument()
    expect(screen.getByText('deactivated@test.com')).toBeInTheDocument()
  })

  it('Admin role badge shows "Admin" with blue styling; Specialist shows "Specialist" with indigo styling', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    // Find Admin badge
    const adminBadge = screen.getAllByText('Admin').find(
      (el) => el.classList.contains('bg-blue-100'),
    )
    expect(adminBadge).toBeTruthy()

    // Find Specialist badges
    const specialistBadges = screen.getAllByText('Specialist').filter(
      (el) => el.classList.contains('bg-indigo-100'),
    )
    expect(specialistBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('Active status badge shows "Active"; deactivated shows "Deactivated"', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    const activeBadges = screen.getAllByText('Active')
    expect(activeBadges.length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Deactivated')).toBeInTheDocument()
  })

  it("Admin's own row does not show Deactivate button", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    // There should be no Deactivate button for admin's own row
    // Admin row is the one with admin-uuid matching current user id
    const deactivateButtons = screen.queryAllByRole('button', { name: /Deactivate Admin User/i })
    expect(deactivateButtons.length).toBe(0)

    // But Deactivate for specialist should exist
    expect(screen.getByRole('button', { name: /Deactivate Specialist User/i })).toBeInTheDocument()
  })

  it('clicking "+ Add Specialist" shows the creation form', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    // Form inputs should not be visible initially
    expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument()

    await user.click(screen.getByText('Add Specialist'))

    // Form inputs should be visible
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByText('Create Account')).toBeInTheDocument()
  })

  it('submitting creation form calls createSpecialistAccount with correct params', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add Specialist'))

    await user.type(screen.getByLabelText('Display Name'), 'New User')
    await user.type(screen.getByLabelText('Email'), 'new@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass123')
    await user.click(screen.getByText('Create Account'))

    await waitFor(() => {
      expect(mockCreateSpecialist).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'pass123',
        displayName: 'New User',
      })
    })
  })

  it('clicking Deactivate shows ConfirmDialog with correct copy', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Specialist User')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Deactivate Specialist User/i }))

    await waitFor(() => {
      expect(screen.getByText('Deactivate Account')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Deactivate Specialist User? They will not be able to log in until reactivated. Their sessions will not be affected.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Keep Active')).toBeInTheDocument()
  })

  it('confirming deactivation calls toggleAccountActive(id, false)', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Specialist User')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Deactivate Specialist User/i }))

    await waitFor(() => {
      expect(screen.getByText('Deactivate Account')).toBeInTheDocument()
    })

    // Click the Deactivate confirm button in dialog (the one in the confirm dialog)
    const deactivateButtons = screen.getAllByText('Deactivate')
    const confirmBtn = deactivateButtons[deactivateButtons.length - 1]
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockToggleActive).toHaveBeenCalledWith('specialist-uuid', false)
    })
  })

  it('clicking Reactivate calls toggleAccountActive(id, true) without confirmation dialog', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Deactivated User')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Reactivate Deactivated User/i }))

    await waitFor(() => {
      expect(mockToggleActive).toHaveBeenCalledWith('deactivated-uuid', true)
    })

    // No ConfirmDialog should have appeared (check that "Deactivate Account" title is NOT present)
    expect(screen.queryByText('Deactivate Account')).not.toBeInTheDocument()
  })

  it('empty state shows "No accounts yet" when list is empty', async () => {
    mockListAccounts.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No accounts yet')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Add your first specialist account to get started with session assignment.'),
    ).toBeInTheDocument()
  })

  it('error state shows error message when listAccounts fails', async () => {
    mockListAccounts.mockRejectedValue(new Error('Network error'))
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText('Could not load accounts. Check your connection and try again.'),
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })
})

describe('AccountRow', () => {
  const baseAccount: Account = {
    id: 'test-uuid',
    email: 'test@test.com',
    display_name: 'Test User',
    role: 'specialist',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  }

  it('renders display name, email, and badges', () => {
    render(
      <AccountRow
        account={baseAccount}
        isCurrentUser={false}
        onDeactivate={() => {}}
        onReactivate={() => {}}
        isToggling={false}
      />,
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
    expect(screen.getByText('Specialist')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
