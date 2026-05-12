import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import {
  createSpecialistAccount,
  toggleAccountActive,
  listAccounts,
  type Account,
} from '../services/adminApi'
import { AccountRow } from '../components/AccountRow'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuthStore } from '../stores/authStore'
import { Eyebrow } from '../ui/Eyebrow'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Icon } from '../ui/icons'

export function AccountManagementPage() {
  const user = useAuthStore((s) => s.user)

  // Account list state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Account | null>(null)
  const [toggleError, setToggleError] = useState<{
    id: string
    message: string
  } | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoadError(null)
      const data = await listAccounts()
      setAccounts(data)
    } catch {
      setLoadError('Could not load accounts. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Auto-clear toggle error after 5 seconds
  useEffect(() => {
    if (toggleError) {
      const timer = setTimeout(() => setToggleError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toggleError])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setCreateError('All fields are required.')
      return
    }

    setCreating(true)

    try {
      await createSpecialistAccount({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      })
      setFormOpen(false)
      setDisplayName('')
      setEmail('')
      setPassword('')
      setCreating(false)
      fetchAccounts()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      if (message.includes('User already registered')) {
        setCreateError('An account with this email already exists.')
      } else {
        setCreateError(message)
      }
      setCreating(false)
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return

    const target = deactivateTarget
    setDeactivateTarget(null)
    setTogglingId(target.id)

    setAccounts((prev) =>
      prev.map((a) => (a.id === target.id ? { ...a, is_active: false } : a))
    )

    try {
      await toggleAccountActive(target.id, false)
    } catch {
      setAccounts((prev) =>
        prev.map((a) => (a.id === target.id ? { ...a, is_active: true } : a))
      )
      setToggleError({
        id: target.id,
        message: 'Failed to deactivate account. Please try again.',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleReactivate = async (account: Account) => {
    setTogglingId(account.id)

    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, is_active: true } : a))
    )

    try {
      await toggleAccountActive(account.id, true)
    } catch {
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, is_active: false } : a))
      )
      setToggleError({
        id: account.id,
        message: 'Failed to reactivate account. Please try again.',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDiscard = () => {
    setFormOpen(false)
    setDisplayName('')
    setEmail('')
    setPassword('')
    setCreateError(null)
  }

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      {/* Back navigation */}
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-accent text-sm font-medium mb-4 hover:underline"
      >
        <Icon name="back" size={14} aria-hidden />
        Settings
      </Link>

      {/* Page title — italic display per unified design language */}
      <header className="mb-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="tpc-display tpc-display-2 mt-1 text-ink">
          Account Management
        </h1>
      </header>

      {/* Add Specialist / Discard toggle button */}
      {!formOpen ? (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setFormOpen(true)}
          icon={<Icon name="plus" size={14} aria-hidden />}
        >
          Add Specialist
        </Button>
      ) : (
        <Button variant="ghost" fullWidth onClick={handleDiscard}>
          Discard
        </Button>
      )}

      {/* Inline creation form */}
      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="tpc-card p-4 mt-3 flex flex-col gap-4"
          style={{ background: 'var(--bg-2)' }}
        >
          <Input
            id="displayName"
            label="Display Name"
            type="text"
            placeholder="Full name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {createError && (
            <p role="alert" className="text-sm text-err">
              {createError}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={creating}>
            {creating ? 'Creating…' : 'Create Account'}
          </Button>
        </form>
      )}

      {/* Account list */}
      <div className="space-y-3 mt-6">
        {loading ? (
          <>
            <div className="tpc-card p-4 h-20 animate-pulse" style={{ background: 'var(--bg-2)' }} />
            <div className="tpc-card p-4 h-20 animate-pulse" style={{ background: 'var(--bg-2)' }} />
            <div className="tpc-card p-4 h-20 animate-pulse" style={{ background: 'var(--bg-2)' }} />
          </>
        ) : loadError ? (
          <div className="tpc-card p-4" style={{ background: 'var(--err-wash)' }}>
            <p className="text-err text-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                fetchAccounts()
              }}
              className="mt-2 text-sm font-semibold text-accent"
            >
              Try Again
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="tpc-card p-6 text-center" style={{ background: 'var(--bg-2)' }}>
            <p className="text-ink font-medium">No accounts yet</p>
            <p className="text-sm text-ink-3 mt-1">
              Add your first specialist account to get started with session assignment.
            </p>
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.id}>
              <AccountRow
                account={account}
                isCurrentUser={account.id === user?.id}
                onDeactivate={() => setDeactivateTarget(account)}
                onReactivate={() => handleReactivate(account)}
                isToggling={togglingId === account.id}
              />
              {toggleError && toggleError.id === account.id && (
                <p className="text-sm text-err mt-1 px-4">{toggleError.message}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Deactivation confirmation dialog */}
      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate Account"
        message={
          deactivateTarget
            ? `Deactivate ${deactivateTarget.display_name}? They will not be able to log in until reactivated. Their sessions will not be affected.`
            : ''
        }
        confirmLabel="Deactivate"
        cancelLabel="Keep Active"
        destructive
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
