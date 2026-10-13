import { admin, drainStorageCleanup } from '../_shared/storageCleanup.ts';

const json = (body: unknown, status = 200) => 
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

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
