import { StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard } from 'react-native'
import React, { useState } from 'react'
import SmallButton from '@/src/components/smallButton'
import TextBox from '@/src/components/textbox'
import LargeButton from '@/src/components/largeButton'
import { ChevronLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Colors from '@/src/constants/Colors'
import { supabase } from '@/src/lib/supabase'
import { Alert } from 'react-native'
import { useAuth } from '@/src/context/AuthProvider'

const login = () => {
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const{signIn}= useAuth();
  const handleSignIn=async() => {
    if(!email || !password){
      Alert.alert("Please Provide the Credentials")
      return
    }

    setLoading(true)
    try{
      await signIn(email, password)
    }catch (error:any){
      alert(error.message)
    }finally{
      setLoading(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <SmallButton icon={ChevronLeft}
          onPress={() => router.back()}
          style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
        />
        <Text style={styles.text}>Login</Text>
        <TextBox value={email} onChangeText={setEmail} placeholder='E-mail'/>
        <TextBox value={password} onChangeText={setPassword} placeholder='Password'/>
        <LargeButton label={loading ? 'Logging In...' : 'Login'} disabled={loading} onPress={handleSignIn}/>
        <Text style={styles.subText}>-- or --</Text>
        <LargeButton label='Login with Google' disabled={false} onPress={() => router.push('/journeys')} 
          style={{
            backgroundColor: Colors.theme.text,
            borderRadius: 40, 
          }}/>
        <LargeButton label='Login with Apple' disabled={false} onPress={() => router.push('/journeys')} 
          style={{
            backgroundColor: Colors.theme.text,
            borderRadius: 40, 
          }}/>
      </View>
    </TouchableWithoutFeedback>
  )
}

export default login

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    color: Colors.theme.text,
    fontSize: 40,
    marginBottom: 15,
    fontWeight: '800',
    textAlign: 'center',
  }, 
  subText: {
    color: Colors.theme.textMutedLight,
    fontSize: 20,
    margin: 20,
    fontWeight: '600',
    textAlign: 'center',
  }, 
})