import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ErrorText from '../ErrorText';

describe('ErrorText', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
  ])('renders nothing for %s, so it takes no space on the screen', async (_, message) => {
    const view = await render(<ErrorText message={message} onRetry={() => {}} />);

    expect(view.toJSON()).toBeNull();
  });

  it('shows the message as an alert, so a screen reader announces it', async () => {
    const view = await render(<ErrorText message="We could not find that." />);

    expect(view.getByRole('alert')).toHaveTextContent('We could not find that.');
  });

  it('offers no retry unless it is given one', async () => {
    const view = await render(<ErrorText message="We could not find that." />);

    expect(view.queryByRole('button')).toBeNull();
  });

  it('calls onRetry from its Try again button', async () => {
    const onRetry = jest.fn();
    const view = await render(<ErrorText message="We could not find that." onRetry={onRetry} />);

    await fireEvent.press(view.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses a custom retry label when given one', async () => {
    const view = await render(
      <ErrorText message="We could not find that." onRetry={() => {}} retryLabel="Retry" />
    );

    expect(view.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(view.queryByText('Try again')).toBeNull();
  });
});
