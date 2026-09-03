import { supabase } from './supabase';

const BUCKET = 'avatars';

export const avatarObjectPath = (userId: string, mimeType?: string, now: Date = new Date()) => {
  const ext = mimeType?.split('/')[1] ?? 'jpg';
  return `${userId}/${now.getTime()}.${ext}`;
};

export const uploadAvatarFile = async (path: string, uri: string, mimeType?: string) => {
  // fetch().blob() is broken in React Native; arrayBuffer() is the supported route.
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg' });
  if (error) throw error;
};

export const removeAvatarFile = async (path: string) => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
};

export const avatarUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
