/**
 * @file forgotPassword.tsx
 * @description The first step of resetting a password: the user gives their email and gets a code.
 * Reached from the login screen, which passes along any email already typed there
 */
import { StyleSheet, Text } from 'react-native';
import React, { useState } from 'react';
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
import { normalizeEmail } from '@/src/validation/userForms';

const ForgotPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = (Array.isArray(params.email) ? params.email[0] : params.email) ?? '';

  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);

  const cleanEmail = normalizeEmail(email);

  const handleSend = async () => {
    setFormError(undefined);
    if (!cleanEmail.includes('@')) {
      setEmailError('Enter a valid email');
      return;
    }

    setSending(true);
    try {
      // Reuses a code already sent to this email, so going back and forth doesn't cancel it
      await requestPasswordReset(cleanEmail);
      router.push({ pathname: '/resetPassword', params: { email: cleanEmail } });
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'ForgotPassword.send' }));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        style={[styles.back, { top: insets.top }]}
      />
      <Screen scroll center gradient bottomOffset={spacing.xxl}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.body}>
          Enter the email for your account and we&apos;ll send you a code to set a new password.
        </Text>

        <TextBox
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setEmailError(undefined);
          }}
          error={!!emailError}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          testID="forgot-email-input"
        />
        <ErrorText message={emailError} style={styles.fieldError} />
        <ErrorText message={formError} style={styles.formError} testID="forgot-form-error" />

        <LargeButton
          label={sending ? 'Sending...' : 'Send Code'}
          disabled={sending}
          onPress={handleSend}
          testID="forgot-submit"
        />
      </Screen>
    </>
  );
};

export default ForgotPasswordScreen;

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
  fieldError: {
    marginLeft: spacing.md,
  },
  formError: {
    alignSelf: 'center',
  },
});
