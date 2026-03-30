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
      // Success: collapse form, reset fields, re-fetch
      setFormOpen(false)
      setDisplayName('')
      setEmail('')
      setPassword('')
      setCreating(false)
      fetchAccounts()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      // Map common Supabase errors
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

    // Optimistic update
    setAccounts((prev) =>
      prev.map((a) => (a.id === target.id ? { ...a, is_active: false } : a))
    )

    try {
      await toggleAccountActive(target.id, false)
    } catch {
      // Revert optimistic update
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

    // Optimistic update
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, is_active: true } : a))
    )

    try {
      await toggleAccountActive(account.id, true)
    } catch {
      // Revert optimistic update
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
        className="text-sm text-accent font-semibold flex items-center gap-1 mb-4"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Settings
      </Link>

      {/* Page title */}
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Account Management
      </h1>

      {/* Add Specialist / Discard toggle button */}
      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="min-h-12 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-accent text-sm font-semibold hover:border-accent hover:bg-accent/5 dark:hover:border-accent dark:hover:bg-accent/5 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add Specialist
        </button>
      ) : (
        <button
          onClick={handleDiscard}
          className="min-h-12 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          Discard
        </button>
      )}

      {/* Inline creation form */}
      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-3"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                placeholder="Full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-12"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-12"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Temporary password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-12"
              />
            </div>
          </div>

          {createError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full min-h-12 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      {/* Account list */}
      <div className="space-y-3 mt-6">
        {loading ? (
          <>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-20 animate-pulse" />
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-20 animate-pulse" />
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-20 animate-pulse" />
          </>
        ) : loadError ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300 text-sm">
              {loadError}
            </p>
            <button
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              No accounts yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Add your first specialist account to get started with session
              assignment.
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
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 px-4">
                  {toggleError.message}
                </p>
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
