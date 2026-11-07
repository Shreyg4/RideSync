import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';
import type { PlaceSuggestion } from '@/src/types/trip';

type PlaceResultItemProps = {
  place: PlaceSuggestion;
  loading: boolean;
  onPress: () => void;
  testID?: string;
};

const PlaceResultItem = ({ place, loading, onPress, testID }: PlaceResultItemProps) => (
  <Pressable
    onPress={() => {
      haptics.action();
      onPress();
    }}
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={[place.name, place.address].filter(Boolean).join(', ')}
    accessibilityState={{ busy: loading }}
    style={({ pressed }) => [styles.row, pressFeedback.card(pressed)]}
  >
    <View style={styles.text}>
      <Text style={styles.name} numberOfLines={1}>
        {place.name}
      </Text>
      {place.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {place.address}
        </Text>
      ) : null}
    </View>
    {loading ? <ActivityIndicator color={colors.tint} /> : null}
  </Pressable>
);

export default PlaceResultItem;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  // Long names and addresses shrink so the spinner after them stays on screen
  text: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  address: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
});
