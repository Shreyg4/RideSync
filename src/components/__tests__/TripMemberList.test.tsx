import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import TripMemberList from '../TripMemberList';
import type { TripMember } from '@/src/types/trip';

const members: TripMember[] = [
  { id: 'user-1', name: 'Ana', role: 'owner', avatar: 'https://example.com/ana.png' },
  { id: 'user-2', name: 'Bea', role: 'editor', avatar: null },
  { id: 'user-3', name: 'Cal', role: 'viewer', avatar: null },
];

describe('TripMemberList', () => {
  it('shows each member with their role', async () => {
    const view = await render(<TripMemberList members={members} />);

    for (const [name, role] of [
      ['Ana', 'Owner'],
      ['Bea', 'Editor'],
      ['Cal', 'Viewer'],
    ]) {
      expect(view.getByText(name)).toBeTruthy();
      expect(view.getByText(role)).toBeTruthy();
    }
  });

  it(`labels each avatar with whose it is`, async () => {
    const view = await render(<TripMemberList members={members} />);

    expect(view.getByLabelText("Ana's profile picture")).toBeTruthy();
    expect(view.getByLabelText("Bea's profile picture")).toBeTruthy();
    expect(view.getByLabelText("Cal's profile picture")).toBeTruthy();
  });

  it('renders no rows for an empty list', async () => {
    const view = await render(<TripMemberList members={[]} testID="members" />);

    expect(view.getByTestId('members').children).toHaveLength(0);
  });
});
