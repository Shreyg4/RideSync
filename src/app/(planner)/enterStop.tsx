import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/SmallButton';
import React from 'react';
import Colors from '@/src/constants/colors';
import { fontSize, fontWeight } from '@/src/constants/typography';

const EnterStopScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerRow, { marginTop: insets.top }]}>
        <Text style={styles.title}>Set Stop</Text>
        <View style={styles.headerLeft}>
          <SmallButton icon={ChevronLeft} onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
};

export default EnterStopScreen;

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
