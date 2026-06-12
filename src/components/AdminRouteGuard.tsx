import { Navigate, Outlet } from 'react-router'
import { useUserRole } from '../hooks/useUserRole'

export function AdminRouteGuard() {
  const { role, isAdmin, loading } = useUserRole()
  const canAdmin = isAdmin || role === 'dev' || role === 'admin'

  if (loading) return null
  if (!canAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
