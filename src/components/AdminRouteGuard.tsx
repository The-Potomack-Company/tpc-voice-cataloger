import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

export function AdminRouteGuard() {
  const user = useAuthStore((s) => s.user)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? null)
        setLoading(false)
      })
  }, [user])

  if (loading) return null
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
