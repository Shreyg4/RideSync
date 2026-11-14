/**
 * @file signUpCompletion.ts
 * @description The last step of creating an account, once there's a session: the optional photo
 * goes up, and the user is told the account is ready. Shared by sign-up, when the project doesn't
 * ask for a confirmed email, and by the verify email screen when it does
 */
import { Alert } from 'react-native';
import { uploadAvatar } from '@/src/services/avatarService';
import { reportAndDescribe } from '@/src/services/errors';

export type PickedAvatar = { uri: string; mimeType?: string };

export const completeSignUp = async (userId: string | undefined, avatar?: PickedAvatar) => {
  let avatarFailed = false;
  if (userId && avatar) {
    try {
      await uploadAvatar(userId, avatar.uri, avatar.mimeType);
    } catch (e) {
      // The account is fine without a photo, so this never undoes the sign-up
      avatarFailed = true;
      reportAndDescribe(e, { scope: 'SignUp.uploadAvatar' });
    }
  }
  Alert.alert(
    'Account created successfully',
    avatarFailed ? "We couldn't upload your photo - you can add it in Settings." : undefined
  );
};
