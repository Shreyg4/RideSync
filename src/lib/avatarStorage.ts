import { supabase } from './supabase';

// Puts an image in the avatars bucket and points the caller's profile row at it.
// Returns the stored path (not a URL) - that's what profiles.avatar_image holds, and
// what remove() needs later. Build a display URL with avatarUrl() below.
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

  // fetch().blob() is broken in React Native; arrayBuffer() is the supported route.
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: rowError } = await supabase
    .from('profiles')
    .update({ avatar_image: path })
    .eq('id', userId);
  if (rowError) throw rowError;

  return path;
};

// Synchronous - just string concatenation, no network - so it's safe to call during render.
// The bucket is public, so this URL needs no signing and never expires.
export const avatarUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
