import { supabase } from '@/src/lib/supabase';
import { reportError } from '@/src/lib/logger';

export const isUsernameAvailable = async (candidate: string): Promise<boolean | null> => {
  const { data, error } = await supabase.rpc('username_available', { candidate });
  if (error) {
    reportError(error, { scope: 'userService.isUsernameAvailable' });
    return null;
  }
  return data;
};

export const getUserAvatarPath = async (userId: string | undefined): Promise<string | null> => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('avatar_path')
    .eq('id', userId)
    .single();

  if (error) {
    reportError(error, { scope: 'userService.getUserAvatarPath' });
    throw error;
  }
  return data.avatar_path;
};

export const setUserAvatarPath = async (userId: string, avatarPath: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ avatar_path: avatarPath })
    .eq('id', userId);
  if (error) throw error;
};
