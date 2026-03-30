import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/admin-client.ts'
import { verifyAdmin } from '../_shared/verify-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminCheck = await verifyAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const { userId, activate } = await req.json()
  if (!userId || typeof activate !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'userId and activate (boolean) are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Prevent self-deactivation
  if (userId === adminCheck.userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot modify your own account' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createAdminClient()

  if (activate) {
    // Reactivate: unban at auth level + set is_active true
    const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: 'none' }
    )
    if (unbanError) {
      return new Response(
        JSON.stringify({ error: unbanError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId)
    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } else {
    // Deactivate: ban at auth level + set is_active false
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: '876000h' }
    )
    if (banError) {
      return new Response(
        JSON.stringify({ error: banError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)
    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
