// purge-audio — service-role retention + orphan sweep for the 'audio' bucket.
//
// Invoked server-to-server by the `purge-old-audio` pg_cron job
// (20260601000000_create_audio.sql), NOT by end users. The security boundary is a
// shared cron secret (PURGE_AUDIO_SECRET) compared against the x-purge-secret
// header — NOT verifyAdmin (no user JWT exists in a cron invocation). The function
// is service-role (bypasses RLS), so the secret gate is load-bearing: T-32-04.
//
// It computes its own deletion set from the DB — it NEVER accepts caller-supplied
// storage paths. Two sources:
//   (a) RETENTION (D-03): audio whose item is ai_status='done' AND
//       completed_at < now() - interval '30 days'.
//   (b) ORPHAN BACKSTOP (D-04): storage.objects under 'audio' with no matching
//       public.audio metadata row.
//
// Deletion is via storage.from('audio').remove(paths) — NEVER
// `DELETE FROM storage.objects` (that drops the row but orphans the S3 binary,
// the exact photo leak D-04 closes). Metadata rows are deleted after the blob.

import { getCorsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/admin-client.ts'

const RETENTION_DAYS = 30

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  // --- Security boundary: shared cron secret (T-32-04) ---
  const expectedSecret = Deno.env.get('PURGE_AUDIO_SECRET')
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'PURGE_AUDIO_SECRET not configured' }),
      { status: 500, headers: jsonHeaders }
    )
  }
  const providedSecret = req.headers.get('x-purge-secret')
  if (!providedSecret || providedSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: jsonHeaders }
    )
  }

  const supabaseAdmin = createAdminClient()

  // --- (a) RETENTION: audio for items done > 30 days (D-03) ---
  const cutoffIso = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: expiredRows, error: expiredErr } = await supabaseAdmin
    .from('audio')
    .select('id, storage_path, items!inner(ai_status, completed_at)')
    .eq('items.ai_status', 'done')
    .lt('items.completed_at', cutoffIso)

  if (expiredErr) {
    return new Response(
      JSON.stringify({ error: expiredErr.message }),
      { status: 500, headers: jsonHeaders }
    )
  }

  const expiredPaths = (expiredRows ?? [])
    .map((r) => r.storage_path as string)
    .filter(Boolean)
  const expiredIds = (expiredRows ?? []).map((r) => r.id as string)

  // --- (b) ORPHAN BACKSTOP: storage objects with no metadata row (D-04) ---
  const orphanPaths: string[] = []
  {
    const { data: knownRows, error: knownErr } = await supabaseAdmin
      .from('audio')
      .select('storage_path')
    if (knownErr) {
      return new Response(
        JSON.stringify({ error: knownErr.message }),
        { status: 500, headers: jsonHeaders }
      )
    }
    const knownPaths = new Set((knownRows ?? []).map((r) => r.storage_path as string))

    // Walk the bucket and collect objects that have no metadata row. Paginated so
    // a large bucket doesn't blow memory; the bucket is laid out as
    // audio/{sessionId}/{itemId}/{audioId}.{ext}, so list recursively from root.
    const pageSize = 1000
    // Supabase storage.list returns one directory level at a time; recurse.
    const walk = async (prefix: string): Promise<void> => {
      let page = 0
      while (true) {
        const { data: entries, error: listErr } = await supabaseAdmin.storage
          .from('audio')
          .list(prefix, { limit: pageSize, offset: page * pageSize })
        if (listErr) throw listErr
        if (!entries || entries.length === 0) break
        for (const entry of entries) {
          const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
          // A folder entry has no id/metadata; recurse into it.
          const isFolder = entry.id === null || entry.id === undefined
          if (isFolder) {
            await walk(fullPath)
          } else if (!knownPaths.has(fullPath)) {
            orphanPaths.push(fullPath)
          }
        }
        if (entries.length < pageSize) break
        page += 1
      }
    }
    try {
      await walk('')
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `orphan scan failed: ${(e as Error).message}` }),
        { status: 500, headers: jsonHeaders }
      )
    }
  }

  // --- Delete blobs first (storage.remove), then metadata rows ---
  const pathsToRemove = Array.from(new Set([...expiredPaths, ...orphanPaths]))
  let removed = 0
  if (pathsToRemove.length > 0) {
    const { error: removeErr } = await supabaseAdmin.storage
      .from('audio')
      .remove(pathsToRemove)
    if (removeErr) {
      return new Response(
        JSON.stringify({ error: removeErr.message }),
        { status: 500, headers: jsonHeaders }
      )
    }
    removed = pathsToRemove.length
  }

  // Delete the expired metadata rows (orphans have no row by definition).
  if (expiredIds.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from('audio')
      .delete()
      .in('id', expiredIds)
    if (delErr) {
      return new Response(
        JSON.stringify({ error: delErr.message }),
        { status: 500, headers: jsonHeaders }
      )
    }
  }

  return new Response(
    JSON.stringify({
      removed,
      expired: expiredPaths.length,
      orphans: orphanPaths.length,
    }),
    { headers: jsonHeaders }
  )
})
