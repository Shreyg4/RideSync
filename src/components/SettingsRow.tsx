import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';
import { haptics, type HapticRole } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, View, ViewStyle, Text, StyleSheet } from 'react-native';

// One tappable row in a settings list: icon, name with a hint under it, and a chevron.
// Each row draws its own divider underneath
type SettingsRowProps = {
  icon: LucideIcon;
  settingName: string;
  settingHint: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  haptic?: HapticRole;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function SettingsRow({
  icon: Icon,
  settingName,
  settingHint,
  onPress,
  color = colors.text,
  backgroundColor = colors.background,
  haptic = 'selection',
  testID,
  style,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={() => {
        haptics[haptic]();
        onPress();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${settingName}, ${settingHint}`}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          backgroundColor,
        },
        style,
      ]}
    >
      <View style={styles.container}>
        <Icon color={color} size={25} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{settingName}</Text>
          <Text style={styles.hint}>{settingHint}</Text>
        </View>
        <ChevronRight color={colors.textMuted} size={20} />
      </View>
      <View style={styles.horizontalLine} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 16,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    marginLeft: 8,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    marginLeft: 8,
  },
  horizontalLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textMutedLight,
    width: '95%',
    alignSelf: 'center',
  },
});
