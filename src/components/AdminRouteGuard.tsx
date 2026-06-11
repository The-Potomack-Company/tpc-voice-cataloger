import { Navigate, Outlet } from 'react-router'
import { useUserRole } from '../hooks/useUserRole'

export function AdminRouteGuard() {
  const { role, loading } = useUserRole()

  if (loading) return null
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
