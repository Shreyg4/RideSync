import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react-native';
import Colors from '@/src/constants/colors';

export type UsernameState = 'idle' | 'checking' | 'free' | 'taken';

export const availabilityIndicator = (state: UsernameState) =>
  ({
    idle: null,
    checking: { text: 'Checking…', color: Colors.textMuted, Icon: LoaderCircle },
    free: { text: 'Available', color: Colors.success, Icon: CircleCheck },
    taken: { text: 'Already taken', color: Colors.error, Icon: CircleX },
  })[state];
