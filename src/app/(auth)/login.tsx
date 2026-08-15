import { StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard } from 'react-native'
import React, { useState } from 'react'
import SmallButton from '@/src/components/smallButton'
import TextBox from '@/src/components/textbox'
import LargeButton from '@/src/components/largeButton'
import { ChevronLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Colors from '@/src/constants/Colors'
import { useAuth } from '@/src/context/AuthProvider'

//Sign-in screen. Errors come in two tiers:
//  - errors: per-field problems we can spot locally (missing password, malformed email)
//  - formError: whatever the server said, shown once above the button and never pinned to a field.
const login = () => {
  type FieldErrors = Partial<Record<'email' | 'password', string>>
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [errors, setErrors] = useState<FieldErrors>({})

  //Matches the normalization the sign-up screen applies before creating the account.
  const cleanEmail = email.trim().toLowerCase()

  //Accounts created under older rules must still be able to sign in, and rejecting locally would leak the password policy.
  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!cleanEmail.includes('@')) next.email = 'Enter valid email'   //The email check is a typo-catcher
    if (!password) next.password = 'Required'
    return next
  }

  //Typing in a field clears that field's error.
  const updateField = (key: keyof FieldErrors, setter: (v: string) => void) =>
  (text: string) => {
    setter(text)
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const{signIn}= useAuth();
  const handleSignIn=async() => {
    setFormError(undefined) //clear the previous failure, or the user can't tell old from new
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try{
      await signIn(cleanEmail, password)
      //No navigation here: RootLayoutNav watches the session and redirects once it lands.
    }catch (e:any){
      setFormError(e.message)
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
        <TextBox value={email} onChangeText={updateField('email', setEmail)} error={!!errors.email} placeholder='E-mail' autoCapitalize='none' keyboardType='email-address'/>
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <TextBox value={password} onChangeText={updateField('password', setPassword)} error={!!errors.password} placeholder='Password' secureTextEntry={true}/>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        {/* Whole-form message. marginLeft is zeroed because errorText indents to line up
            with the field boxes, which is wrong for a centered line. */}
        {formError ? <Text style={[styles.errorText, {alignSelf: 'center', marginLeft: 0}]}>{formError}</Text> : null}
        <LargeButton label={loading ? 'Logging In...' : 'Login'} disabled={loading} onPress={handleSignIn}/>
        
        {/* OAuth vaulted for now */}
        {/* <Text style={styles.subText}>-- or --</Text>
        <LargeButton label='Login with Google' disabled={false} onPress={() => router.push('/journeys')} 
          style={{
            backgroundColor: Colors.theme.text,
            borderRadius: 40, 
          }}/>
        <LargeButton label='Login with Apple' disabled={false} onPress={() => router.push('/journeys')} 
          style={{
            backgroundColor: Colors.theme.text,
            borderRadius: 40, 
          }}/> */}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default login

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    color: Colors.theme.text,
    fontSize: 40,
    marginBottom: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: '50%'
  }, 
  subText: {
    color: Colors.theme.textMutedLight,
    fontSize: 20,
    margin: 20,
    fontWeight: '600',
    textAlign: 'center',
  },   
  errorText: {
    color: Colors.theme.error,
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 15
  }, 
})