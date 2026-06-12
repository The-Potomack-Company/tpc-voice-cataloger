import { supabase } from '../lib/supabase'
import { ensureFreshSession } from '../lib/authGuard'
import { isFirebaseAuthBackend } from '../lib/authBackend'

export interface Account {
  id: string
  email: string
  display_name: string
  role: string
  is_active: boolean
  created_at: string
}

export async function createSpecialistAccount(params: {
  email: string
  password: string
  displayName: string
}): Promise<{ user: { id: string; email: string } }> {
  if (isFirebaseAuthBackend()) {
    return catalogerApiFetch('/admin/create-user', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: params,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function toggleAccountActive(
  userId: string,
  activate: boolean
): Promise<{ success: boolean }> {
  if (isFirebaseAuthBackend()) {
    return catalogerApiFetch('/admin/update-user', {
      method: 'POST',
      body: JSON.stringify({ userId, activate }),
    })
  }

  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { userId, activate },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listAccounts(): Promise<Account[]> {
  if (isFirebaseAuthBackend()) {
    const data = await catalogerApiFetch<{ accounts: Account[] }>('/admin/list-users')
    return data.accounts
  }

  const { data, error } = await supabase.functions.invoke('admin-list-users')
  if (error) throw new Error(error.message)
  return data.accounts
}

async function catalogerApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiUrl = import.meta.env.VITE_CATALOGER_API_URL;
  if (!apiUrl) {
    throw new Error("VITE_CATALOGER_API_URL is not set. Add it to .env.local");
  }
  const token = await ensureFreshSession()
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error ?? 'Cataloger API request failed')
  }
  return data
}
