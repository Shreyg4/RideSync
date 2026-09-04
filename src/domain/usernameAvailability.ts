import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react-native';
import { colors } from '@/src/constants/theme'

export type UsernameState = 'idle' | 'checking' | 'free' | 'taken';

export const availabilityIndicator = (state: UsernameState) =>
  ({
    idle: null,
    checking: { text: 'Checking…', color: colors.textMuted, Icon: LoaderCircle },
    free: { text: 'Available', color: colors.success, Icon: CircleCheck },
    taken: { text: 'Already taken', color: colors.error, Icon: CircleX },
  })[state];
