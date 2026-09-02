import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/smallButton';
import React from 'react';
import Colors from '@/src/constants/colors';

const EnterStop = () => {
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

export default EnterStop;

const styles = StyleSheet.create({
  title: {
    color: Colors.theme.text,
    fontSize: 25,
    fontWeight: '600',
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
