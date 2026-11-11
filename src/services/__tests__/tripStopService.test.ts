import { describe, expect, it, jest } from '@jest/globals';
import { mockChannels, mockSupabase } from '@/src/test/supabase';
import { subscribeToTripStops } from '../tripStopService';

describe('subscribeToTripStops', () => {
  it(`listens for every change to that trip's stops, and only that trip`, () => {
    subscribeToTripStops(7, () => {});
    const [channel] = mockChannels();

    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_stops', filter: 'trip_id=eq.7' },
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('calls back for an add, an edit and a removal, even though a removal only carries the id', () => {
    const onChange = jest.fn();
    subscribeToTripStops(7, onChange);
    const [channel] = mockChannels();

    channel.__emit({ eventType: 'INSERT', new: { id: 3, trip_id: 7 }, old: {} });
    channel.__emit({ eventType: 'UPDATE', new: { id: 3, trip_id: 7 }, old: { id: 3 } });
    channel.__emit({ eventType: 'DELETE', new: {}, old: { id: 3 } });

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('gives each subscription its own channel, so unsubscribing one leaves the other open', () => {
    const unsubscribeFirst = subscribeToTripStops(7, () => {});
    subscribeToTripStops(7, () => {});
    const [first, second] = mockChannels();

    expect(first.topic).not.toBe(second.topic);

    unsubscribeFirst();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(first);
    expect(mockChannels()).toEqual([second]);
  });
});
