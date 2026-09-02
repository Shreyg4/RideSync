import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useState, useEffect } from 'react';
import SmallButton from '@/src/components/smallButton';
import { ChevronLeft, LoaderCircle, CircleCheck, CircleX } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/src/constants/colors';
import TextBox from '@/src/components/textbox';
import LargeButton from '@/src/components/largeButton';
import { useAuth } from '@/src/context/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import AvatarImage from '@/src/components/avatarImage';
import { uploadAvatar } from '@/src/lib/avatarStorage';
import * as Haptics from 'expo-haptics';

// Account creation screen.
// Validation happens in two layers:
//  - validate() is the gate. It runs on submit and decides whether we call Supabase at all.
//  - the hint/availability text under the username box is derived during render, so it
//    updates live as the user types. Nothing is stored for it.

// Must stay in sync with the check constraint on profiles.username in the create_profiles migration.
// If you widen one, widen the other, or the DB will reject names the app accepted.
const HANDLE = /^[a-zA-Z0-9_]+$/;

const SignUp = () => {
  // A message per field. A key being present means "this field is wrong"; the string is what we show.
  type FieldErrors = Partial<
    Record<'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword', string>
  >;
  // The text fields we clean up before validating or sending. Passwords are deliberately absent (see normalize).
  type Form = { firstName: string; lastName: string; username: string; email: string };

  const insets = useSafeAreaInsets();
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Result of the live username lookup. 'idle' also covers "we couldn't check".
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'free' | 'taken'>(
    'idle'
  );

  const pickAvatarImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;

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
    if (candidate.length < 5 || !HANDLE.test(candidate)) {
      setUsernameState('idle');
      return;
    }

    let cancelled = false;
    setUsernameState('checking');

    const timer = setTimeout(async () => {
      // username_available is a security definer function that sees past RLS and returns only a boolean.
      const { data, error } = await supabase.rpc('username_available', { candidate });
      if (cancelled) return; // a newer keystroke already superseded this response
      setUsernameState(error ? 'idle' : data ? 'free' : 'taken');
    }, 400);

    // Runs before every re-run and on unmount: kills the timer, and flags any in-flight
    // request so a slow old response can't overwrite a newer one.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  // Clean the user's raw typing once, at the submit boundary, so everything downstream sees identical values.
  const normalize = (raw: Form): Form => ({
    firstName: raw.firstName.trim(),
    lastName: raw.lastName.trim(),
    username: raw.username.trim(),
    email: raw.email.trim().toLowerCase(),
  });

  // Takes the already-normalized values as a parameter rather than reading state directly.
  const validate = (v: Form): FieldErrors => {
    const next: FieldErrors = {};
    if (!v.firstName) next.firstName = 'Required';
    if (!v.lastName) next.lastName = 'Required';

    // Length before format, so a short name gets the more useful of the two messages.
    if (v.username.length < 5) next.username = 'At least 5 characters';
    else if (!HANDLE.test(v.username)) next.username = 'Letters, numbers and underscores only';

    if (!v.email.includes('@')) next.email = 'Enter a valid email';
    if (password.length < 8) next.password = 'Password is not long enough';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    return next;
  };

  // Wraps a state setter so typing in a field also clears that field's error.
  const updateField = (key: keyof FieldErrors, setter: (v: string) => void) => (text: string) => {
    setter(text);
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // The live line under the username box. Keyed by the state union, so adding a new state
  // to usernameState makes TypeScript flag the missing case here.
  const availability = {
    idle: null,
    checking: { text: 'Checking…', color: Colors.theme.textMuted, Icon: LoaderCircle },
    free: { text: 'Available', color: Colors.theme.success, Icon: CircleCheck },
    taken: { text: 'Already taken', color: Colors.theme.error, Icon: CircleX },
  }[usernameState];

  const { signUp } = useAuth();
  const handleSignUp = async () => {
    const clean = normalize({ firstName, lastName, username, email });
    const found = validate(clean);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Availability lives outside FieldErrors, so it gets its own gate. 'checking' is included
    // because the 400ms debounce is easy to beat by tapping straight after typing.
    if (usernameState === 'taken' || usernameState === 'checking') return;

    setLoading(true);
    try {
      const user = await signUp(
        clean.firstName,
        clean.lastName,
        clean.username,
        clean.email,
        password
      );
      if (user && avatarAsset) {
        try {
          await uploadAvatar(user.id, avatarAsset.uri, avatarAsset.mimeType);
        } catch (e) {
          console.warn('avatar upload failed', e); // deliberately not rethrown
        }
      }
      Alert.alert('Account created successfully');
    } catch (e: any) {
      // Two people can claim a name in the same second, so the unique index is the real
      // enforcement. When that fires it surfaces as an opaque "Database error saving new
      // user", so re-check and turn it into a message on the right field.
      const { data: stillFree } = await supabase.rpc('username_available', {
        candidate: clean.username,
      });
      // === false, not !stillFree: a failed RPC returns null, and we mustn't read that as "taken".
      if (stillFree === false) {
        setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
      } else {
        Alert.alert(e.message);
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
        {/* Avater Image Picker */}
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
        <Text style={styles.subtext}>Name</Text>
        <TextBox
          value={firstName}
          onChangeText={updateField('firstName', setFirstName)}
          error={!!errors.firstName}
          placeholder="First Name"
        />
        {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
        <TextBox
          value={lastName}
          onChangeText={updateField('lastName', setLastName)}
          error={!!errors.lastName}
          placeholder="Last Name"
        />
        {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}

        {/* Username. Two lines sit under the box: the rules hint (replaced by the error
            after a failed submit) and the live availability row. */}
        <Text style={styles.subtext}>Unique Username and E-mail</Text>
        <TextBox
          value={username}
          onChangeText={updateField('username', setUsername)}
          error={!!errors.username}
          placeholder="Username"
          autoCapitalize="none"
          maxLength={20}
        />
        {errors.username ? (
          <Text style={styles.errorText}>{errors.username}</Text>
        ) : (
          <Text style={styles.infoText}>5–20 characters, letters, numbers and underscores</Text>
        )}
        {availability ? (
          <View style={styles.availabilityRow}>
            <Text style={[styles.availablityText, { color: availability.color, marginLeft: 0 }]}>
              {availability.text}
            </Text>
            <availability.Icon size={16} color={availability.color} />
          </View>
        ) : null}

        {/* E-mail */}
        <TextBox
          value={email}
          onChangeText={updateField('email', setEmail)}
          error={!!errors.email}
          placeholder="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        {/* Password */}
        <Text style={styles.subtext}>Set Password</Text>
        <TextBox
          value={password}
          onChangeText={updateField('password', setPassword)}
          error={!!errors.password}
          placeholder="Password"
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
          placeholder="Re-enter password"
          secureTextEntry={true}
        />
        {errors.confirmPassword ? (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
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

export default SignUp;

const styles = StyleSheet.create({
  text: {
    color: Colors.theme.text,
    fontSize: 40,
    marginBottom: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtext: {
    color: Colors.theme.tint,
    fontSize: 20,
    marginVertical: 5,
    marginLeft: 15,
    fontWeight: '600',
  },
  infoText: {
    color: Colors.theme.textMutedLight,
    fontSize: 15,
    marginTop: -7,
    marginBottom: 5,
    fontWeight: '400',
    marginLeft: 15,
  },
  errorText: {
    color: Colors.theme.error,
    fontSize: 15,
    marginTop: -7,
    marginBottom: 5,
    fontWeight: '400',
    marginLeft: 15,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 15,
  },
  availablityText: {
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 15,
  },
});
