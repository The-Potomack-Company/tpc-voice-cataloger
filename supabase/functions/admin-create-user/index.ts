import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/admin-client.ts'
import { verifyAdmin } from '../_shared/verify-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminCheck = await verifyAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const { email, password, displayName } = await req.json()
  if (!email || !password || !displayName) {
    return new Response(
      JSON.stringify({ error: 'email, password, and displayName are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, role: 'specialist' },
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ user: { id: data.user.id, email: data.user.email } }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
