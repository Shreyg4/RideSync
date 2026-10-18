import TextBox from '@/src/components/TextBox';
import LargeButton from '@/src/components/LargeButton';
import Screen from '@/src/components/Screen';
import ErrorText from '@/src/components/ErrorText';
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { JOIN_CODE_LENGTH, formatJoinCode } from '@/src/domain/rules';
import { normalizeJoinCode } from '@/src/validation/tripForms';
import { joinTrip } from '@/src/services/tripService';
import { reportAndDescribe } from '@/src/services/errors';

export default function JoinTripScreen() {
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>();
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    if (typeof linkedCode === 'string') setJoinCode(normalizeJoinCode(linkedCode));
  }, [linkedCode]);

  const handleJoin = async (code = joinCode) => {
    setFormError(undefined);
    setLoading(true);
    try {
      const tripId = await joinTrip(code);
      if (tripId === null) {
        setFormError("That code doesn't match an active trip.");
        return;
      }
      setJoinCode('');
      router.push(`/trips/${tripId}`);
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope: 'joinTrip.handleJoin' }));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCode = (text: string) => {
    const next = normalizeJoinCode(text);
    setJoinCode(next);
    setFormError(undefined);
  };

  return (
    <Screen bottomOffset={tabBarHeight}>
      <TextBox
        value={formatJoinCode(joinCode)}
        onChangeText={handleChangeCode}
        placeholder="Enter code"
        autoCapitalize="characters"
        error={!!formError}
        testID="join-code-input"
      />
      <ErrorText message={formError} style={{ alignSelf: 'center' }} testID="join-trip-error" />
      <LargeButton
        label={loading ? 'Joining…' : 'Join Trip'}
        onPress={handleJoin}
        disabled={loading || joinCode.length !== JOIN_CODE_LENGTH}
        testID="join-trip-button"
      />
    </Screen>
  );
}
