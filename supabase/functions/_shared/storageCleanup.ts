import { createClient } from 'npm:@supabase/supabase-js@2';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Removes queued files in batches until the queue is empty or a bucket keeps failing.
// Rows for a failed bucket stay queued so the next run retries them
export const drainStorageCleanup = async () => {
  for (;;) {
    const { data: rows, error } = await admin
      .from('storage_cleanup_queue')
      .select('bucket_id, path')
      .order('queued_at')
      .limit(100);
    if (error) throw error;
    if (rows.length === 0) return;

    const byBucket = new Map<string, string[]>();
    for (const { bucket_id, path } of rows) {
      byBucket.set(bucket_id, [...(byBucket.get(bucket_id) ?? []), path]);
    }

    let cleared = 0;
    for (const [bucket, paths] of byBucket) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error('storage removal failed', bucket, removeError);
        continue;
      }
      const { error: dequeueError } = await admin
        .from('storage_cleanup_queue')
        .delete()
        .eq('bucket_id', bucket)
        .in('path', paths);
      if (dequeueError) throw dequeueError;
      cleared += paths.length;
    }

    if (cleared === 0) return;
  }
};