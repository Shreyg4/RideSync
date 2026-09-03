import { StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import React, { useState } from 'react';
import SmallButton from '@/src/components/smallButton';
import TextBox from '@/src/components/textbox';
import LargeButton from '@/src/components/largeButton';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/src/constants/colors';
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
const Login = () => {
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <SmallButton
          icon={ChevronLeft}
          onPress={() => router.back()}
          style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
        />
        <Text style={styles.text}>Login</Text>
        <TextBox
          value={email}
          onChangeText={updateField('email', setEmail)}
          error={!!errors.email}
          placeholder="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <TextBox
          value={password}
          onChangeText={updateField('password', setPassword)}
          error={!!errors.password}
          placeholder="Password"
          secureTextEntry={true}
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        {/* Whole-form message. marginLeft is zeroed because errorText indents to line up
            with the field boxes, which is wrong for a centered line. */}
        {formError ? (
          <Text style={[styles.errorText, { alignSelf: 'center', marginLeft: 0 }]}>
            {formError}
          </Text>
        ) : null}
        <LargeButton
          label={loading ? 'Logging In...' : 'Login'}
          disabled={loading}
          onPress={handleSignIn}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    color: Colors.theme.text,
    fontSize: 40,
    marginBottom: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: '50%',
  },
  errorText: {
    color: Colors.theme.error,
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 15,
  },
});
