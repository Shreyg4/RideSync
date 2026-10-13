import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const json = (body: unknown, status = 200) => 
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Rows stay queued if a bucket's removal fails, so the next run retries them
const drainStorageCleanup = async () => {
  const { data: rows, error } = await admin
    .from('storage_cleanup_queue')
    .select('bucket_id, path')
    .limit(100);
  if (error) throw error;

  const byBucket = new Map<string, string[]>();
  for (const { bucket_id, path } of rows) {
    byBucket.set(bucket_id, [...(byBucket.get(bucket_id) ?? []), path]);
  }

  for (const [bucket, paths] of byBucket) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error('storage removal failed', bucket, removeError);
      continue;
    }
    await admin.from('storage_cleanup_queue').delete().eq('bucket_id', bucket).in('path', paths);
  }
};

// Catches avatar uploads whose path never made it onto the users row
const removeStrayAvatars = async (userId: string) => {
  const { data: files } = await admin.storage.from('avatars').list(userId);
  if (files?.length) {
    await admin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
  }
};


Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return json({ error: 'not_authenticated' }, 401);

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  // Cascades auth.users -> users -> trips / trip_members / saved_trips.
  // The triggers hand off shared trips and queue unused files in the same transaction
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return json({ error: 'delete_failed' }, 500);
  }

  // The account is already gone; if file cleanup fails, the rows stay queued for the next run
  try {
    await removeStrayAvatars(user.id);
    await drainStorageCleanup();
  } catch (error) {
    console.error('storage cleanup failed', error);
  }

  return json({ deleted: true });
});
