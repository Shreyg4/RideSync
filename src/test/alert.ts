import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { Alert } from 'react-native';

/** Stops Alert.alert opening a native dialog and records each call. Call it in beforeEach. */
export const mockAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

/** The title, message and buttons of the most recent alert. */
export const lastAlert = () => {
  const call = jest.mocked(Alert.alert).mock.calls.at(-1);
  if (!call) throw new Error('No alert was shown');
  const [title, message, buttons = []] = call;
  return { title, message, buttons };
};

/** Presses a button in the most recent alert, the way tapping it would. */
export const pressAlertButton = async (text: string) => {
  const button = lastAlert().buttons.find((candidate) => candidate.text === text);
  if (!button) throw new Error(`The last alert has no "${text}" button`);
  // Not awaited, like a real alert: a handler that starts a request must not hold up the test
  await act(async () => {
    button.onPress?.();
  });
};
