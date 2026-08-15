import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LargeButton from '@/src/components/largeButton';
import Colors from '@/src/constants/colors';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/context/AuthProvider';
import AvatarImage from '@/src/components/avatarImage';
import { avatarUrl } from '@/src/lib/avatarStorage';
import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function settings() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth()
  const [photoPath, setPhotoPath] = useState<string | null>(null)

  useEffect(() => {

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_image')
        .eq('id', user?.id)
        .single()

        if (cancelled) return
        if (!error) setPhotoPath(data.avatar_image)
    })()

    return () => { cancelled = true }
  }, [user?.id])
  
  const handleSignOut=async() => {
    try{
      await signOut();
    }catch(error:any){
      alert(error.message)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 75}}>
        <View>
          <AvatarImage uri={avatarUrl(photoPath)} style={{alignSelf: 'center', marginVertical: 20}} />
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
            onPress={handleSignOut} 
            color='red'
            backgroundColor={Colors.theme.border}
            backgroundColorPressed={Colors.theme.card}
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
    marginBottom: '140%'
  },
});
