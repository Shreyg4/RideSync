import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useState, useEffect } from 'react';
import SmallButton from '@/src/components/SmallButton';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/src/constants/colors';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { copy } from '@/src/constants/copy';
import TextBox from '@/src/components/TextBox';
import LargeButton from '@/src/components/LargeButton';
import { useAuth } from '@/src/context/AuthProvider';
import * as ImagePicker from 'expo-image-picker';
import AvatarImage from '@/src/components/AvatarImage';
import { uploadAvatar } from '@/src/services/avatarService';
import { isUsernameAvailable } from '@/src/services/userService';
import { reportAndDescribe } from '@/src/services/errors';
import { USERNAME_MAX_LENGTH } from '@/src/domain/rules';
import { availabilityIndicator, type UsernameState } from '@/src/domain/usernameAvailability';
import {
  isUsernameCandidate,
  normalizeSignUpForm,
  validateSignUpForm,
  type SignUpFieldErrors,
  type SignUpForm,
} from '@/src/validation/userForms';
import * as Haptics from 'expo-haptics';

// Account creation screen.
// Validation happens in two layers:
//  - validate() is the gate. It runs on submit and decides whether we call Supabase at all.
//  - the hint/availability text under the username box is derived during render, so it
//    updates live as the user types. Nothing is stored for it.

const SignUpScreen = () => {
  const insets = useSafeAreaInsets();
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SignUpFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  // Result of the live username lookup. 'idle' also covers "we couldn't check".
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');

  const pickAvatarImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      setFormError('Photo access is off. Enable it in Settings to pick a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // gives user crop step
      aspect: [1, 1], // square crop
      quality: 0.7, // JPEG compression
    });

    if (result.canceled) return;
    setAvatarAsset(result.assets[0]);
  };

  // Debounced username availability check.
  useEffect(() => {
    const candidate = username.trim();
    // Don't ask the server about names that can never be valid - it would show a green
    if (!isUsernameCandidate(candidate)) {
      setUsernameState('idle');
      return;
    }

    let cancelled = false;
    setUsernameState('checking');

    const timer = setTimeout(async () => {
      const available = await isUsernameAvailable(candidate);
      if (cancelled) return; // a newer keystroke already superseded this response
      setUsernameState(available === null ? 'idle' : available ? 'free' : 'taken');
    }, 400);

    // Runs before every re-run and on unmount: kills the timer, and flags any in-flight
    // request so a slow old response can't overwrite a newer one.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  // Wraps a state setter so typing in a field also clears that field's error.
  const updateField =
    (key: keyof SignUpFieldErrors, setter: (v: string) => void) => (text: string) => {
      setter(text);
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

  const availability = availabilityIndicator(usernameState);

  const { signUp } = useAuth();
  const handleSignUp = async () => {
    setFormError(undefined);
    const raw: SignUpForm = { firstName, lastName, username, email };
    const clean = normalizeSignUpForm(raw);
    const found = validateSignUpForm(clean, password, confirmPassword);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Availability lives outside the field errors, so it gets its own gate. 'checking' is
    // included because the 400ms debounce is easy to beat by tapping straight after typing.
    if (usernameState === 'taken') {
      setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
      return;
    }
    if (usernameState === 'checking') {
      setFormError('Still checking that username - one moment.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUp(
        clean.firstName,
        clean.lastName,
        clean.username,
        clean.email,
        password
      );
      let avatarFailed = false;
      if (user && avatarAsset) {
        try {
          await uploadAvatar(user.id, avatarAsset.uri, avatarAsset.mimeType);
        } catch (e) {
          avatarFailed = true;
          reportAndDescribe(e, { scope: 'SignUp.uploadAvatar' });
        }
      }
      Alert.alert(
        'Account created successfully',
        avatarFailed ? "We couldn't upload your photo - you can add it in Settings." : undefined
      );
    } catch (e) {
      // Two people can claim a name in the same second, so the unique index is the real
      // enforcement. When that fires it surfaces as an opaque "Database error saving new
      // user", so re-check and turn it into a message on the right field.
      const stillFree = await isUsernameAvailable(clean.username);
      // === false, not !stillFree: a failed lookup returns null, and we mustn't read that as "taken".
      if (stillFree === false) {
        setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
      } else {
        setFormError(reportAndDescribe(e, { scope: 'SignUp.signUp' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
      />
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: '35%', paddingBottom: 50 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        bottomOffset={125}
      >
        <Text style={styles.text}>Create Account</Text>
        {/* Avatar Image Picker */}
        <Pressable
          onPress={pickAvatarImage}
          style={{ alignSelf: 'center', marginVertical: 20, pointerEvents: 'box-only' }}
        >
          <AvatarImage uri={avatarAsset?.uri} />
        </Pressable>
        <Text style={[styles.subtext, { alignSelf: 'center', marginLeft: 0 }]}>
          Profile Picture (optional)
        </Text>
        {/* Name */}
        <Text style={styles.subtext}>{copy.headings.name}</Text>
        <TextBox
          value={firstName}
          onChangeText={updateField('firstName', setFirstName)}
          error={!!errors.firstName}
          placeholder={copy.fields.firstName}
        />
        {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
        <TextBox
          value={lastName}
          onChangeText={updateField('lastName', setLastName)}
          error={!!errors.lastName}
          placeholder={copy.fields.lastName}
        />
        {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}

        {/* Username. Two lines sit under the box: the rules hint (replaced by the error
            after a failed submit) and the live availability row. */}
        <Text style={styles.subtext}>{copy.headings.usernameAndEmail}</Text>
        <TextBox
          value={username}
          onChangeText={updateField('username', setUsername)}
          error={!!errors.username}
          placeholder={copy.fields.username}
          autoCapitalize="none"
          maxLength={USERNAME_MAX_LENGTH}
        />
        {errors.username ? (
          <Text style={styles.errorText}>{errors.username}</Text>
        ) : (
          <Text style={styles.infoText}>5–20 characters, letters, numbers and underscores</Text>
        )}
        {availability ? (
          <View style={styles.availabilityRow}>
            <Text style={[styles.availabilityText, { color: availability.color, marginLeft: 0 }]}>
              {availability.text}
            </Text>
            <availability.Icon size={16} color={availability.color} />
          </View>
        ) : null}

        {/* Email */}
        <TextBox
          value={email}
          onChangeText={updateField('email', setEmail)}
          error={!!errors.email}
          placeholder={copy.fields.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        {/* Password */}
        <Text style={styles.subtext}>{copy.headings.setPassword}</Text>
        <TextBox
          value={password}
          onChangeText={updateField('password', setPassword)}
          error={!!errors.password}
          placeholder={copy.fields.password}
          secureTextEntry={true}
        />
        {errors.password ? (
          <Text style={styles.errorText}>{errors.password}</Text>
        ) : (
          <Text style={styles.infoText}>Must be at least 8-characters long</Text>
        )}

        <TextBox
          value={confirmPassword}
          onChangeText={updateField('confirmPassword', setConfirmPassword)}
          error={!!errors.confirmPassword}
          placeholder={copy.fields.confirmPassword}
          secureTextEntry={true}
        />
        {errors.confirmPassword ? (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        ) : null}

        {formError ? (
          <Text style={[styles.errorText, { textAlign: 'center', marginLeft: 0 }]}>
            {formError}
          </Text>
        ) : null}

        <LargeButton
          label={loading ? 'Creating Account...' : 'Create Account'}
          disabled={loading}
          onPress={handleSignUp}
        />
      </KeyboardAwareScrollView>
    </View>
  );
};

export default SignUpScreen;

const styles = StyleSheet.create({
  text: {
    color: Colors.text,
    fontSize: fontSize.screenTitle,
    marginBottom: 10,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  subtext: {
    color: Colors.tint,
    fontSize: fontSize.section,
    marginVertical: 5,
    marginLeft: 15,
    fontWeight: fontWeight.semibold,
  },
  infoText: {
    color: Colors.textMutedLight,
    fontSize: fontSize.caption,
    marginTop: -7,
    marginBottom: 5,
    fontWeight: fontWeight.regular,
    marginLeft: 15,
  },
  errorText: {
    color: Colors.error,
    fontSize: fontSize.caption,
    marginTop: -7,
    marginBottom: 5,
    fontWeight: fontWeight.regular,
    marginLeft: 15,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 15,
  },
  availabilityText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    marginLeft: 15,
  },
});
