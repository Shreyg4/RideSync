/**
 * @file PlaceCard.tsx
 * @description What a tapped pin found, over the bottom of the map, with the button that picks it
 */
import { X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import SmallButton from '@/src/components/SmallButton';
import { colors, fontSize, fontWeight, radii, spacing } from '@/src/constants/theme';
import type { Place } from '@/src/types/trip';

type PlaceCardProps = {
  place: Place;
  onChoose: () => void;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PlaceCard = ({ place, onChoose, onClose, style, testID }: PlaceCardProps) => (
  <View style={[styles.card, style]} testID={testID}>
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {place.name}
        </Text>
        {place.address ? (
          <Text style={styles.address} numberOfLines={2}>
            {place.address}
          </Text>
        ) : null}
      </View>
      <SmallButton
        icon={X}
        onPress={onClose}
        accessibilityLabel="Close place"
        color={colors.textMutedLight}
        backgroundColor="transparent"
        size={20}
        diameter={36}
      />
    </View>
    <LargeButton label="Choose this place" onPress={onChoose} testID="place-card-choose" />
  </View>
);

export default PlaceCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  // A long name wraps instead of pushing the close button off the card
  text: {
    flex: 1,
    paddingTop: spacing.xxs,
    paddingLeft: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  address: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
  },
});
