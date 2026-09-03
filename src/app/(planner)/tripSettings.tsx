import { StyleSheet, Text, View } from 'react-native';
import SmallButton from '@/src/components/SmallButton';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '@/src/constants/colors';
import { gradients } from '@/src/constants/gradients';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

const TripSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient {...gradients.cardToBackground} style={StyleSheet.absoluteFill} />
      <View style={[styles.headerRow, { marginTop: insets.top }]}>
        <Text style={styles.title}>Trip Settings</Text>
        <View style={styles.headerLeft}>
          <SmallButton icon={ChevronLeft} onPress={() => router.back()} />
        </View>
      </View>
      <Text>tripSettings</Text>
    </View>
  );
};

export default TripSettingsScreen;

const styles = StyleSheet.create({
  title: {
    color: Colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.semibold,
    alignSelf: 'center',
  },
  headerRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
