import type { Account } from '../services/adminApi'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

interface AccountRowProps {
  account: Account
  isCurrentUser: boolean
  onDeactivate: () => void
  onReactivate: () => void
  isToggling: boolean
}

/**
 * Mockup-aligned admin account row. Uses .tpc-card chrome + Badge primitive
 * so the cascade resolves through the unified token set. The action button
 * sits to the right; the row itself is non-interactive.
 */
export function AccountRow({
  account,
  isCurrentUser,
  onDeactivate,
  onReactivate,
  isToggling,
}: AccountRowProps) {
  return (
    <div
      className="tpc-card flex items-center justify-between gap-3 p-4"
      style={{ background: 'var(--bg-2)' }}
      data-testid="account-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-ink font-medium truncate">{account.display_name}</p>
        <p className="text-sm text-ink-3 mt-0.5 truncate">{account.email}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {account.role === 'dev' ? (
            <Badge tone="info">Dev</Badge>
          ) : account.role === 'admin' ? (
            <Badge tone="info">Admin</Badge>
          ) : account.role === 'manager' ? (
            <Badge tone="info">Manager</Badge>
          ) : (
            <Badge>Specialist</Badge>
          )}
          {account.is_active ? (
            <Badge tone="ok" dot>
              Active
            </Badge>
          ) : (
            <Badge tone="err">Deactivated</Badge>
          )}
        </div>
      </div>
      {!isCurrentUser && (
        <div className="shrink-0">
          {account.is_active ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onDeactivate}
              disabled={isToggling}
              aria-label={`Deactivate ${account.display_name}`}
            >
              {isToggling ? '…' : 'Deactivate'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onReactivate}
              disabled={isToggling}
              aria-label={`Reactivate ${account.display_name}`}
            >
              {isToggling ? '…' : 'Reactivate'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
