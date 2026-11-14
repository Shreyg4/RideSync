/**
 * @file verifyEmail.tsx
 * @description Where a new account proves its email is real: the user types the code Supabase
 * emailed them. Reached from sign-up, and from login when an account never finished this step
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import LargeButton from '@/src/components/LargeButton';
import ErrorText from '@/src/components/ErrorText';
import Screen from '@/src/components/Screen';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { reportAndDescribe } from '@/src/services/errors';
import { completeSignUp } from '@/src/services/signUpCompletion';
import {
  cleanEmailCode,
  EMAIL_CODE_LENGTH,
  RESEND_CODE_COOLDOWN_SECONDS,
} from '@/src/validation/userForms';

const firstParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

const VerifyEmailScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    email?: string | string[];
    avatarUri?: string | string[];
    avatarType?: string | string[];
  }>();
  const email = firstParam(params.email) ?? '';
  const avatarUri = firstParam(params.avatarUri);
  const avatar = avatarUri
    ? { uri: avatarUri, mimeType: firstParam(params.avatarType) }
    : undefined;

  const { verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_CODE_COOLDOWN_SECONDS);
  const [resent, setResent] = useState(false);

  // Counts the resend button down a second at a time
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const updateCode = (text: string) => {
    setCode(cleanEmailCode(text));
    setCodeError(undefined);
  };

  const handleVerify = async () => {
    setFormError(undefined);
    if (code.length !== EMAIL_CODE_LENGTH) {
      setCodeError(`Enter the ${EMAIL_CODE_LENGTH}-digit code from the email`);
      return;
    }

    setVerifying(true);
    try {
      const user = await verifyEmail(email, code);
      // The session has landed, so RootLayoutNav is already swapping to the app. This keeps
      // running after the screen goes, which is what lets the photo finish uploading
      await completeSignUp(user?.id, avatar);
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'VerifyEmail.verify' }));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setFormError(undefined);
    setResent(false);
    setResendIn(RESEND_CODE_COOLDOWN_SECONDS);
    try {
      await resendVerification(email);
      setResent(true);
      setCode(''); // the old code stops working once a new one is sent
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'VerifyEmail.resend' }));
      setResendIn(0); // nothing went out, so there's nothing to wait for
    }
  };

  const canResend = resendIn <= 0;

  return (
    <>
      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        style={[styles.back, { top: insets.top }]}
      />
      <Screen scroll center gradient bottomOffset={spacing.xxl}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          Enter the {EMAIL_CODE_LENGTH}-digit code we sent to{' '}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <TextBox
          value={code}
          onChangeText={updateCode}
          error={!!codeError}
          placeholder="Verification code"
          keyboardType="number-pad"
          maxLength={EMAIL_CODE_LENGTH}
          testID="verify-code-input"
        />
        <ErrorText message={codeError} style={styles.fieldError} />
        <ErrorText message={formError} style={styles.formError} testID="verify-form-error" />
        {resent ? (
          <Text style={styles.notice} testID="verify-code-resent">
            A new code is on its way.
          </Text>
        ) : null}

        <LargeButton
          label={verifying ? 'Verifying...' : 'Verify Email'}
          disabled={verifying}
          onPress={handleVerify}
          testID="verify-submit"
        />

        <Pressable
          onPress={handleResend}
          disabled={!canResend}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend }}
          hitSlop={8}
          style={styles.resend}
          testID="verify-resend"
        >
          <Text style={[styles.resendText, !canResend && styles.resendWaiting]}>
            {canResend ? 'Send a new code' : `Send a new code in ${resendIn}s`}
          </Text>
        </Pressable>
      </Screen>
    </>
  );
};

export default VerifyEmailScreen;

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.screenTitle,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  body: {
    color: colors.textMutedLight,
    fontSize: fontSize.body,
    textAlign: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  email: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  fieldError: {
    marginLeft: spacing.md,
  },
  formError: {
    alignSelf: 'center',
  },
  notice: {
    color: colors.success,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resend: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  resendWaiting: {
    color: colors.textMuted,
  },
});
