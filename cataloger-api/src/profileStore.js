let poolPromise = null;
const PG_MODULE = "pg";

function databaseUrlFromEnv(env) {
  return env.CATALOGER_DATABASE_URL ?? env.DATABASE_URL ?? env.PGRST_DB_URI;
}

export async function createPgProfileStore(env = process.env) {
  const connectionString = databaseUrlFromEnv(env);
  if (!connectionString) {
    throw new Error("CATALOGER_DATABASE_URL is not configured");
  }

  if (!poolPromise) {
    poolPromise = import(/* @vite-ignore */ PG_MODULE).then(({ Pool }) => new Pool({
      connectionString,
      max: Number(env.CATALOGER_DATABASE_POOL_SIZE ?? 5),
    }));
  }
  const pool = await poolPromise;
  return createProfileStoreFromPool(pool);
}

export function createProfileStoreFromPool(pool) {
  return {
    async getProfile(userId) {
      const result = await pool.query(
        "select id, email, display_name, role, is_active, created_at from public.profiles where id = $1",
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async upsertProfile(profile) {
      await pool.query(
        `insert into public.profiles (id, email, display_name, role, is_active)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
           email = excluded.email,
           display_name = excluded.display_name,
           role = excluded.role,
           is_active = excluded.is_active`,
        [profile.id, profile.email, profile.display_name, profile.role, profile.is_active],
      );
    },

    async updateActive(userId, isActive) {
      await pool.query(
        "update public.profiles set is_active = $2 where id = $1",
        [userId, isActive],
      );
    },

    async listProfiles() {
      const result = await pool.query(
        `select id, email, display_name, role, is_active, created_at
         from public.profiles
         order by created_at asc`,
      );
      return result.rows;
    },

    async listExpiredAudio(cutoffIso) {
      const result = await pool.query(
        `select a.id, a.storage_path
         from public.audio a
         join public.items i on i.id = a.item_id
         where i.ai_status = 'done'
           and i.completed_at is not null
           and i.completed_at < $1`,
        [cutoffIso],
      );
      return result.rows;
    },

    async listKnownAudioPaths() {
      const result = await pool.query("select storage_path from public.audio");
      return result.rows.map((row) => row.storage_path).filter(Boolean);
    },

    async deleteAudioByIds(ids) {
      if (ids.length === 0) return;
      await pool.query("delete from public.audio where id = any($1::uuid[])", [ids]);
    },
  };
}
