import React from 'react'
import { useEffect } from 'react';
import { Redirect, SplashScreen } from 'expo-router';
import { useAuth } from '@/src/context/AuthProvider';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Colors from '@/src/constants/colors';

export default function index() {
  const{loading, session} = useAuth();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  
  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size={"large"} color={Colors.theme.tint}/>
    </View>
  )
  return <Redirect href={session ? '/journeys' : '/welcome'} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems:'center',
    backgroundColor: Colors.theme.background
  }
})