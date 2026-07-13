import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller'
import React from 'react'
import { useState } from 'react'
import SmallButton from '@/src/components/smallButton'
import { ChevronLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Colors from '@/src/constants/Colors'
import TextBox from '@/src/components/textbox'
import LargeButton from '@/src/components/largeButton'

const signUp = () => {
  const insets = useSafeAreaInsets()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <View style={{flex: 1}}>
      <SmallButton icon={ChevronLeft}
        onPress={() => router.back()}
        style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
      />
      <KeyboardAwareScrollView showsVerticalScrollIndicator={false} 
          contentContainerStyle={{flexGrow: 1, paddingTop: '50%'}} 
          keyboardDismissMode="on-drag" 
          keyboardShouldPersistTaps="handled"
          bottomOffset={30}>
        <Text style={styles.text}>Create Account</Text>
        <TextBox value={username} onChangeText={setUsername} placeholder='Username'/>
        <TextBox value={email} onChangeText={setEmail} placeholder='E-mail'/>
        <TextBox value={password} onChangeText={setPassword} placeholder='Password'/>
        <TextBox value={confirmPassword} onChangeText={setConfirmPassword} placeholder='Re-enter password'/>
        <LargeButton label='Create Account' disabled={false} 
          onPress={() => {
            if (password === '' || confirmPassword === ''){
              setError('Form not complete')
            } 
            else if (password !== confirmPassword) {
              setError('Passwords do not match')
            }
            else {
              setError('')
              router.push('/journeys')
            }
          }}/>

          {error !== '' && <Text style={styles.errorText}>{error}</Text>}
        </KeyboardAwareScrollView>
      </View>

  )
}

export default signUp

const styles = StyleSheet.create({
  text: {
    color: Colors.theme.text,
    fontSize: 40,
    marginBottom: 15,
    fontWeight: '800',
    textAlign: 'center',
  }, 
  errorText: {
    color: 'red',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20
  }, 
})