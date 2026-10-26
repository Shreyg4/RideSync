import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import AvatarImage from '../AvatarImage';

const URI = 'https://example.com/ana.png';

// The one host element inside the avatar's frame: the photo, or the fallback icon
const content = async (uri?: string | null) => {
  const view = await render(<AvatarImage uri={uri} testID="avatar" />);
  const [child] = view.getByTestId('avatar').children;
  return child as { type: string; props: Record<string, unknown> };
};

describe('AvatarImage', () => {
  it('shows the photo at the uri', async () => {
    const child = await content(URI);

    expect(child.type).toBe('Image');
    expect(child.props.source).toEqual({ uri: URI });
  });

  it.each([
    ['no uri', undefined],
    ['a null uri', null],
    ['an empty uri', ''],
  ])('shows the fallback icon, not an empty image, for %s', async (_, uri) => {
    const child = await content(uri);

    expect(child.type).not.toBe('Image');
  });

  it('is announced as an image, named "Profile picture" unless given a label', async () => {
    const view = await render(
      <>
        <AvatarImage uri={URI} />
        <AvatarImage uri={URI} accessibilityLabel="Ana's profile picture" />
      </>
    );

    expect(view.getByRole('image', { name: 'Profile picture' })).toBeTruthy();
    expect(view.getByRole('image', { name: "Ana's profile picture" })).toBeTruthy();
  });
});
