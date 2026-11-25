/**
 * @file resetPassword.tsx
 * @description The second step of resetting a password. The user first types the emailed code,
 * which is checked with Supabase; only once it goes through are they asked for a new password.
 * Saving it signs them in, and RootLayoutNav takes them into the app
 */
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
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
import {
  cleanEmailCode,
  EMAIL_CODE_LENGTH,
  RESEND_CODE_COOLDOWN_SECONDS,
  validateNewPassword,
  validateResetCode,
  type NewPasswordFieldErrors,
} from '@/src/validation/userForms';

const ResetPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = (Array.isArray(params.email) ? params.email[0] : params.email) ?? '';

  const { sendPasswordReset, verifyPasswordReset, updatePassword } = useAuth();
  // A code works once, so after it goes through the screen only asks for the password
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<NewPasswordFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_CODE_COOLDOWN_SECONDS);
  const [resent, setResent] = useState(false);

  // Counts the resend button down a second at a time
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const updateField =
    (key: keyof NewPasswordFieldErrors, setter: (v: string) => void) => (text: string) => {
      setter(text);
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

  const handleVerify = async () => {
    setFormError(undefined);
    setResent(false);
    const found = validateResetCode(code);
    setCodeError(found);
    if (found) return;

    setBusy(true);
    try {
      await verifyPasswordReset(email, code);
      // The number pad is still up for the code box; drop it so the password fields open their own
      Keyboard.dismiss();
      setVerified(true);
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'ResetPassword.verify' }));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setFormError(undefined);
    const found = validateNewPassword(password, confirmPassword);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      // Once this saves, the session is let through and RootLayoutNav swaps to the app
      await updatePassword(password);
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'ResetPassword.reset' }));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setFormError(undefined);
    setResent(false);
    setResendIn(RESEND_CODE_COOLDOWN_SECONDS);
    try {
      await sendPasswordReset(email);
      setResent(true);
      setCode(''); // the old code stops working once a new one is sent
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'ResetPassword.resend' }));
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
        {/* Each step is keyed so its inputs mount fresh. Otherwise React reuses the code box's native
            input (number pad, 6-character limit) as the new password box, which then won't type */}
        {verified ? (
          <View key="password" style={styles.step}>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.body}>
              Your code checked out. Set a new password for{' '}
              <Text style={styles.email}>{email}</Text>.
            </Text>

            <TextBox
              value={password}
              onChangeText={updateField('password', setPassword)}
              error={!!errors.password}
              placeholder="New password"
              secureTextEntry
              testID="reset-password-input"
            />
            <ErrorText message={errors.password} style={styles.fieldError} />

            <TextBox
              value={confirmPassword}
              onChangeText={updateField('confirmPassword', setConfirmPassword)}
              error={!!errors.confirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              testID="reset-confirm-input"
            />
            <ErrorText message={errors.confirmPassword} style={styles.fieldError} />
            <ErrorText message={formError} style={styles.formError} testID="reset-form-error" />

            <LargeButton
              label={busy ? 'Saving...' : 'Reset Password'}
              disabled={busy}
              onPress={handleReset}
              testID="reset-submit"
            />
          </View>
        ) : (
          <View key="code" style={styles.step}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body}>
              If <Text style={styles.email}>{email}</Text> has an account, we sent it a{' '}
              {EMAIL_CODE_LENGTH}-digit code. Enter it below.
            </Text>

            <TextBox
              value={code}
              onChangeText={(text) => {
                setCode(cleanEmailCode(text));
                setCodeError(undefined);
              }}
              error={!!codeError}
              placeholder="Reset code"
              keyboardType="number-pad"
              maxLength={EMAIL_CODE_LENGTH}
              testID="reset-code-input"
            />
            <ErrorText message={codeError} style={styles.fieldError} />
            <ErrorText message={formError} style={styles.formError} testID="reset-form-error" />
            {resent ? (
              <Text style={styles.notice} testID="reset-code-resent">
                A new code is on its way.
              </Text>
            ) : null}

            <LargeButton
              label={busy ? 'Checking...' : 'Verify Code'}
              disabled={busy}
              onPress={handleVerify}
              testID="reset-verify"
            />

            <Pressable
              onPress={handleResend}
              disabled={!canResend}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canResend }}
              hitSlop={8}
              style={styles.resend}
              testID="reset-resend"
            >
              <Text style={[styles.resendText, !canResend && styles.resendWaiting]}>
                {canResend ? 'Send a new code' : `Send a new code in ${resendIn}s`}
              </Text>
            </Pressable>
          </View>
        )}
      </Screen>
    </>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  step: {
    alignSelf: 'stretch',
  },
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
