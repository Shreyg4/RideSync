import { reportError } from '@/src/lib/logger';
import {
  avatarObjectPath,
  avatarUrl,
  removeAvatarFile,
  uploadAvatarFile,
} from '@/src/lib/avatarStorage';
import { getUserAvatarPath, setUserAvatarPath } from './userService';

export { avatarUrl };

export const uploadAvatar = async (
  userId: string,
  uri: string,
  mimeType?: string,
  now: Date = new Date()
): Promise<string> => {
  const path = avatarObjectPath(userId, mimeType, now);

  let previousPath: string | null = null;
  try {
    previousPath = await getUserAvatarPath(userId);
  } catch {
    // Already reported by the user service. A missing previous path only costs a stray file.
  }

  await uploadAvatarFile(path, uri, mimeType);
  await setUserAvatarPath(userId, path);

  if (previousPath && previousPath !== path) {
    try {
      await removeAvatarFile(previousPath);
    } catch (error) {
      reportError(error, { scope: 'avatarService.uploadAvatar.removePrevious', previousPath });
    }
  }

  return path;
};
