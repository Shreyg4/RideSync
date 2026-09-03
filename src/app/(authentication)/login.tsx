import { StyleSheet, Text } from 'react-native';
import React, { useState } from 'react';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import LargeButton from '@/src/components/LargeButton';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import ErrorText from '@/src/components/ErrorText';
import Screen from '@/src/components/Screen';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { copy } from '@/src/constants/copy';
import { useAuth } from '@/src/context/AuthProvider';
import { reportAndDescribe } from '@/src/services/errors';
import {
  normalizeEmail,
  validateLoginForm,
  type LoginFieldErrors,
} from '@/src/validation/userForms';

// Sign-in screen. Errors come in two tiers:
//  - errors: per-field problems we can spot locally (missing password, malformed email)
//  - formError: whatever the server said, shown once above the button and never pinned to a field.
const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [errors, setErrors] = useState<LoginFieldErrors>({});

  // Matches the normalization the sign-up screen applies before creating the account.
  const cleanEmail = normalizeEmail(email);

  // Typing in a field clears that field's error.
  const updateField =
    (key: keyof LoginFieldErrors, setter: (v: string) => void) => (text: string) => {
      setter(text);
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

  const { signIn } = useAuth();
  const handleSignIn = async () => {
    setFormError(undefined); // clear the previous failure, or the user can't tell old from new
    const found = validateLoginForm(cleanEmail, password);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      await signIn(cleanEmail, password);
      // No navigation here: RootLayoutNav watches the session and redirects once it lands.
    } catch (e) {
      setFormError(reportAndDescribe(e, { scope: 'Login.signIn' }));
    } finally {
      setLoading(false);
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
      <Screen scroll bottomOffset={spacing.xxl}>
        <Text style={styles.text}>Login</Text>
        <TextBox
          value={email}
          onChangeText={updateField('email', setEmail)}
          error={!!errors.email}
          placeholder={copy.fields.email}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="email-input"
        />
        <ErrorText message={errors.email} style={styles.fieldError} />

        <TextBox
          value={password}
          onChangeText={updateField('password', setPassword)}
          error={!!errors.password}
          placeholder={copy.fields.password}
          secureTextEntry={true}
          testID="password-input"
        />
        <ErrorText message={errors.password} style={styles.fieldError} />
        <ErrorText message={formError} style={styles.formError} testID="login-form-error" />

        <LargeButton
          label={loading ? 'Logging In...' : 'Login'}
          disabled={loading}
          onPress={handleSignIn}
          testID="login-submit"
        />
      </Screen>
    </>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
  },
  text: {
    color: Colors.text,
    fontSize: fontSize.screenTitle,
    marginBottom: spacing.md,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
    marginTop: spacing.xxl * 2,
  },
  fieldError: {
    marginLeft: spacing.md,
  },
  formError: {
    alignSelf: 'center',
  },
});
