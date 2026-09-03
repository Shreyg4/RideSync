import { FlatList, StyleSheet, Text, View } from 'react-native';
import React, { useState } from 'react';
import { Settings, Plus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/SmallButton';
import LargeButton from '@/src/components/LargeButton';
import ScreenHeader from '@/src/components/ScreenHeader';
import Colors from '@/src/constants/colors';
import { radii } from '@/src/constants/radii';
import { spacing } from '@/src/constants/spacing';
import { gradients } from '@/src/constants/gradients';
import { LinearGradient } from 'expo-linear-gradient';
import StopListItem from '@/src/components/StopListItem';
import locations from '@/src/__fixtures__/locations';

const PlannerScreen = () => {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <View>
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground}
          style={StyleSheet.absoluteFill}
        />
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <ScreenHeader
            title="Planner"
            onBack={() => router.back()}
            rightAction={
              <SmallButton
                icon={Settings}
                onPress={() => router.push('/tripSettings')}
                accessibilityLabel="Trip settings"
              />
            }
          />
        </View>
      </View>

      <FlatList
        data={locations}
        keyExtractor={(location) => location.id.toString()}
        renderItem={({ item }) => (
          <StopListItem location={item} onPress={() => router.push('/enterStop')} />
        )}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        ListFooterComponent={
          <>
            <SmallButton
              icon={Plus}
              color={Colors.text}
              size={40}
              onPress={() => router.push('/enterStop')}
              accessibilityLabel="Add a stop"
              style={styles.addButton}
            />
            <View style={styles.infoRow}>
              <Text style={styles.subtext}>Trip Distance</Text>
              <Text style={styles.subtext}>Total Time</Text>
            </View>
            <LargeButton label="Directions" onPress={() => router.replace('/trips')} />
            <LargeButton label="Save Trip" onPress={() => router.replace('/trips')} />
          </>
        }
      />

      <LinearGradient
        colors={[Colors.background, 'transparent']}
        pointerEvents="none"
        style={[styles.headerFade, { top: insets.top + headerHeight }]}
      />
    </View>
  );
};

export default PlannerScreen;

const styles = StyleSheet.create({
  headerFade: {
    position: 'absolute',
    height: spacing.md,
    left: 0,
    right: 0,
  },
  listSpacer: {
    height: spacing.sm,
  },
  subtext: {
    color: Colors.text,
    alignSelf: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    margin: spacing.md,
    columnGap: 100,
  },
  addButton: {
    backgroundColor: Colors.tintDark,
    margin: spacing.md,
    width: 50,
    height: 50,
    borderRadius: radii.pill,
    alignSelf: 'center',
  },
});
