import { getCorsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/admin-client.ts'
import { verifyAdmin } from '../_shared/verify-admin.ts'

type AdminListUsersRuntime = {
  createAdminClient: typeof createAdminClient
  verifyAdmin: typeof verifyAdmin
}

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

type DevUserRow = {
  user_id: string
}

type GlobalWithAdminListUsersTestRuntime = typeof globalThis & {
  __adminListUsersTestRuntime?: AdminListUsersRuntime
}

const runtime =
  (globalThis as GlobalWithAdminListUsersTestRuntime).__adminListUsersTestRuntime ?? {
    createAdminClient,
    verifyAdmin,
  }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminCheck = await runtime.verifyAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const supabaseAdmin = runtime.createAdminClient()

  // Get all users from auth (includes email)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  if (authError) {
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get all profiles
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, display_name, role, is_active, created_at')
    .order('created_at', { ascending: true })
  if (profileError) {
    return new Response(
      JSON.stringify({ error: profileError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Service-role clients bypass RLS, so exclude known dev users before returning.
  const { data: devUsers, error: devUsersError } = await supabaseAdmin
    .schema('private')
    .from('dev_users')
    .select('user_id')
  if (devUsersError) {
    return new Response(
      JSON.stringify({ error: devUsersError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const devUserIds = new Set(((devUsers as DevUserRow[] | null) ?? []).map((user) => user.user_id))

  // Build email lookup from auth users
  const emailMap = new Map<string, string>()
  for (const user of authData.users) {
    if (user.email) {
      emailMap.set(user.id, user.email)
    }
  }

  // Merge email from auth into profiles (fallback to profile.email if available)
  const accounts = ((profiles as ProfileRow[] | null) ?? [])
    .filter((profile) => !devUserIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      email: emailMap.get(profile.id) ?? profile.email ?? '',
      display_name: profile.display_name,
      role: profile.role,
      is_active: profile.is_active,
      created_at: profile.created_at,
    }))

  return new Response(
    JSON.stringify({ accounts }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
