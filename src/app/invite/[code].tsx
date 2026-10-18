/**
 * @file [code].tsx
 * @description Where shared invite links (ridesync://invite/<code>) land. Hands the code to the Join Trip tab
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/joinTrip', params: { code } }} />;
}
