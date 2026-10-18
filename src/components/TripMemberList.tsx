/**
 * @file TripMemberList.tsx
 * @description Everyone on a trip as an avatar with their name underneath, wrapping onto new rows
 */
import { StyleSheet, Text, View } from 'react-native';
import AvatarImage from '@/src/components/AvatarImage';
import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';
import { memberRoleLabel } from '@/src/domain/rules';
import type { TripMember } from '@/src/types/trip';

const AVATAR_SIZE = 56;
const ITEM_WIDTH = 80;

type TripMemberListProps = {
  members: TripMember[];
  testID?: string;
};

export default function TripMemberList({ members, testID }: TripMemberListProps) {
  return (
    <View style={styles.grid} testID={testID}>
      {members.map((member) => (
        <View key={member.id} style={styles.member}>
          <AvatarImage
            uri={member.avatar}
            size={AVATAR_SIZE}
            accessibilityLabel={`${member.name}'s profile picture`}
          />
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.role}>{memberRoleLabel(member.role)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  member: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  role: {
    color: colors.tintSubtle,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
});
