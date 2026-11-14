/**
 * @file userService.ts
 * @description The data-access layer for the users table.
 * Only place in the app that talks directly to the users table in supabase.
 */
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

export type UserProfile = {
  username: string;
  firstName: string;
  lastName: string;
  showFullName: boolean; // what fellow trip members see: full name when true, username otherwise
  avatarPath: string | null;
};

export const getUserProfile = async (userId: string | undefined): Promise<UserProfile | null> => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('username, first_name, last_name, show_full_name, avatar_path')
    .eq('id', userId)
    .single();

  if (error) {
    reportError(error, { scope: 'userService.getUserProfile' });
    throw error;
  }
  return {
    username: data.username,
    firstName: data.first_name,
    lastName: data.last_name,
    showFullName: data.show_full_name,
    avatarPath: data.avatar_path,
  };
};

// The database works display_name out from this, so trip members see the change too
export const setShowFullName = async (userId: string, showFullName: boolean): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ show_full_name: showFullName })
    .eq('id', userId);
  if (error) throw error;
};

export const setUserAvatarPath = async (userId: string, avatarPath: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ avatar_path: avatarPath })
    .eq('id', userId);
  if (error) throw error;
};
