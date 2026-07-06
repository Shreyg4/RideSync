import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LargeButton from '@/src/components/largeButton';
import Colors from '@/src/constants/Colors';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function settings() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 75}} 
          keyboardDismissMode="on-drag" 
          keyboardShouldPersistTaps="never">
        <View>
          <Text style={styles.text}>Settings that will come soon</Text>
          <LargeButton 
            label='Delete Account' 
            onPress={() => router.back()} 
            color='red'
            backgroundColor={Colors.theme.border}
            backgroundColorPressed={Colors.theme.card}
          />
          <LargeButton 
            label='Log Out' 
            onPress={() => router.back()} 
            color='red'
            backgroundColor={Colors.theme.border}
            backgroundColorPressed={Colors.theme.card}
            style={{
              marginTop: 20
            }}
          />
        </View>
      </ScrollView>
      {/* Gradient header overlay: solid at the top, fading to transparent at the bottom */}
      <LinearGradient
        colors={[Colors.theme.background, Colors.theme.background, 'transparent']}
        locations={[0, 0, 1]}
        style={[styles.header]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  text: {
    color: Colors.theme.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 600
  },
});
