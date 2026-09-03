import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react-native';
import Colors from '@/src/constants/colors';

export type UsernameState = 'idle' | 'checking' | 'free' | 'taken';

export const availabilityIndicator = (state: UsernameState) =>
  ({
    idle: null,
    checking: { text: 'Checking…', color: Colors.theme.textMuted, Icon: LoaderCircle },
    free: { text: 'Available', color: Colors.theme.success, Icon: CircleCheck },
    taken: { text: 'Already taken', color: Colors.theme.error, Icon: CircleX },
  })[state];
