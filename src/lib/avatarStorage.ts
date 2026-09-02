import { reportError } from './logger';
import { supabase } from './supabase';

// Puts an image in the avatars bucket and points the caller's user row at it.
// Returns the stored path (not a URL) - that's what users.avatar_path holds, and
// what removeAvatar() takes. Build a display URL with avatarUrl() below.
//
// Order matters: upload first, then repoint the row. The row update is the commit point,
// so a failed upload leaves everything as it was rather than a row pointing at nothing.
export const uploadAvatar = async (
  userId: string,
  uri: string,
  mimeType?: string
): Promise<string> => {
  const ext = mimeType?.split('/')[1] ?? 'jpg';
  // Unique per upload, so a changed photo gets a new URL and no CDN or RN image cache
  // can serve the old one. The userId prefix is what the storage RLS policies check.
  const path = `${userId}/${Date.now()}.${ext}`;

  const { data: existing } = await supabase
    .from('users')
    .select('avatar_path')
    .eq('id', userId)
    .single();
  const previousPath = existing?.avatar_path ?? null;

  // fetch().blob() is broken in React Native; arrayBuffer() is the supported route.
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: rowError } = await supabase
    .from('users')
    .update({ avatar_path: path })
    .eq('id', userId);
  if (rowError) throw rowError;

  if (previousPath && previousPath !== path) await removeAvatar(previousPath);

  return path;
};

export const removeAvatar = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) reportError(error, { scope: 'avatarStorage.removeAvatar', path });
};

// Synchronous - just string concatenation, no network - so it's safe to call during render.
// The bucket is public, so this URL needs no signing and never expires.
export const avatarUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
