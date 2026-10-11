/**
 * @file tripImageStorage.ts
 * @description The wrapper around the supabase storage
 * bucket named trip-images which stores a trips image
 */
import { supabase } from './supabase';

const BUCKET = 'trip-images';

export const tripImageObjectPath = (userId: string, mimeType?: string, now: Date = new Date()) => {
  const ext = mimeType?.split('/')[1] ?? 'jpg';
  return `${userId}/${now.getTime()}.${ext}`;
};

export const uploadTripImageFile = async (path: string, uri: string, mimeType?: string) => {
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg' });
  if (error) throw error;
};

export const removeTripImageFile = async (path: string) => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
};

export const tripImageUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
