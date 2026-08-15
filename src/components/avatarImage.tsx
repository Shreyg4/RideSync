import Colors from '@/src/constants/Colors';
import { User } from 'lucide-react-native';
import { StyleProp, View, ViewStyle, Image, StyleSheet } from 'react-native';

// Component to hold avatar image
type AvatarImageProps = {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
  borderWidth?: number;
};

export default function AvatarImage({
  uri,
  size = 110,
  borderColor = Colors.theme.tint,
  borderWidth = 1,
  style
}: AvatarImageProps) {
  return(
    <View style={[{width: size, height: size, borderRadius: size / 2, borderColor, borderWidth, pointerEvents: 'none'}, styles.base, style]}>
      {uri
        ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover"/>
        : <User size={size * 0.45} color={Colors.theme.textMuted} />
      }
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.theme.card
  }
});
