import type { Account } from '../services/adminApi'

interface AccountRowProps {
  account: Account
  isCurrentUser: boolean
  onDeactivate: () => void
  onReactivate: () => void
  isToggling: boolean
}

export function AccountRow({
  account,
  isCurrentUser,
  onDeactivate,
  onReactivate,
  isToggling,
}: AccountRowProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-normal text-gray-900 dark:text-gray-100 truncate">
          {account.display_name}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {account.email}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {account.role === 'admin' ? (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              Admin
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
              Specialist
            </span>
          )}
          {account.is_active ? (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              Deactivated
            </span>
          )}
        </div>
      </div>
      {!isCurrentUser && (
        <div className="shrink-0">
          {account.is_active ? (
            <button
              onClick={onDeactivate}
              disabled={isToggling}
              aria-label={`Deactivate ${account.display_name}`}
              className="min-h-12 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isToggling ? '...' : 'Deactivate'}
            </button>
          ) : (
            <button
              onClick={onReactivate}
              disabled={isToggling}
              aria-label={`Reactivate ${account.display_name}`}
              className="min-h-12 px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isToggling ? '...' : 'Reactivate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
