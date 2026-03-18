import { supabase } from '../lib/supabase'

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
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { userId, activate },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.functions.invoke('admin-list-users')
  if (error) throw new Error(error.message)
  return data.accounts
}
