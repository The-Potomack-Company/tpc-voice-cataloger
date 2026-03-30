import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

export function AdminRouteGuard() {
  const user = useAuthStore((s) => s.user)
  const [role, setRole] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role ?? null)
      })
    return () => { cancelled = true; setRole(undefined) }
  }, [user])

  const loading = !!user && role === undefined

  if (loading) return null
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
