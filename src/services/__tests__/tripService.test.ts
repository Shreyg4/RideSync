// tripService is the only code that talks to the trips tables, so these pin what each call asks
// the database for and how it turns the answer, or the lack of one, into a result or an error.

import { describe, expect, it } from '@jest/globals';
import {
  cancelTrip,
  createTrip,
  deleteTrip,
  getTrip,
  joinTrip,
  leaveTrip,
  listTripMembers,
  listTrips,
  removeTripMember,
  setMemberRole,
  transferTripOwnership,
  type NewTrip,
} from '../tripService';
import { mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';

const queryError = { code: 'PGRST301', message: 'JWT expired' };
const trip = { id: 7, name: 'Coast Run' };

describe('listTrips', () => {
  it('lists trips soonest first', async () => {
    mockTable('trips').__setResult({ data: [trip] });

    await expect(listTrips()).resolves.toEqual([trip]);
    expect(mockTable('trips').select).toHaveBeenCalledWith('*');
    expect(mockTable('trips').order).toHaveBeenCalledWith('starts_at', { ascending: true });
  });

  it('throws the query error', async () => {
    mockTable('trips').__setResult({ error: queryError });
    await expect(listTrips()).rejects.toBe(queryError);
  });
});

describe('getTrip', () => {
  it('fetches the trip with that id', async () => {
    mockTable('trips').__setResult({ data: trip });

    await expect(getTrip(7)).resolves.toEqual(trip);
    expect(mockTable('trips').eq).toHaveBeenCalledWith('id', 7);
    expect(mockTable('trips').maybeSingle).toHaveBeenCalled();
  });

  it('returns null when there is no such trip, or RLS hides it', async () => {
    await expect(getTrip(7)).resolves.toBeNull();
  });

  it('throws the query error', async () => {
    mockTable('trips').__setResult({ error: queryError });
    await expect(getTrip(7)).rejects.toBe(queryError);
  });
});

describe('createTrip', () => {
  const newTrip: NewTrip = {
    name: 'Coast Run',
    starts_at: '2026-11-01T17:30:00.000Z',
    trip_type: 'one-way',
    image_url: null,
  };

  it('inserts the trip and returns the row the database created', async () => {
    mockTable('trips').__setResult({ data: trip });

    await expect(createTrip(newTrip)).resolves.toEqual(trip);
    expect(mockTable('trips').insert).toHaveBeenCalledWith(newTrip);
    expect(mockTable('trips').single).toHaveBeenCalled();
  });

  it('throws the insert error', async () => {
    mockTable('trips').__setResult({ error: queryError });
    await expect(createTrip(newTrip)).rejects.toBe(queryError);
  });
});

describe('joinTrip', () => {
  it('sends the code and returns the id of the trip joined', async () => {
    mockRpc('join_trip', { data: 7 });

    await expect(joinTrip('ABCD2345')).resolves.toBe(7);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('join_trip', { code: 'ABCD2345' });
  });

  it('returns null for a code that matches no active trip', async () => {
    mockRpc('join_trip', { error: { code: 'P0002', message: 'invalid invite code' } });
    await expect(joinTrip('ZZZZ9999')).resolves.toBeNull();
  });

  it('throws any other error', async () => {
    const notSignedIn = { code: '28000', message: 'not authenticated' };
    mockRpc('join_trip', { error: notSignedIn });

    await expect(joinTrip('ABCD2345')).rejects.toBe(notSignedIn);
  });
});

describe('listTripMembers', () => {
  it(`asks for that trip's members`, async () => {
    const members = [{ user_id: 'user-1', role: 'owner' }];
    mockRpc('list_trip_members', { data: members });

    await expect(listTripMembers(7)).resolves.toEqual(members);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_trip_members', { target_trip_id: 7 });
  });

  it('returns an empty list when there is no data', async () => {
    await expect(listTripMembers(7)).resolves.toEqual([]);
  });

  it('throws the query error', async () => {
    mockRpc('list_trip_members', { error: queryError });
    await expect(listTripMembers(7)).rejects.toBe(queryError);
  });
});

// RLS turns a write the caller may not make into a silent no-op, so each of these writes
// asks for the changed rows back and treats none as permission denied.
describe.each([
  {
    name: 'setMemberRole',
    table: 'trip_members',
    write: () => setMemberRole(7, 'user-2', 'editor'),
    changedRow: { user_id: 'user-2' },
  },
  {
    name: 'removeTripMember',
    table: 'trip_members',
    write: () => removeTripMember(7, 'user-2'),
    changedRow: { user_id: 'user-2' },
  },
  {
    name: 'deleteTrip',
    table: 'trips',
    write: () => deleteTrip(7),
    changedRow: { id: 7 },
  },
])('$name', ({ table, write, changedRow }) => {
  it('resolves when the row changed', async () => {
    mockTable(table).__setResult({ data: [changedRow] });
    await expect(write()).resolves.toBeUndefined();
  });

  it.each([
    ['an empty list', []],
    ['null', null],
  ])('treats %s of changed rows as permission denied', async (_, data) => {
    mockTable(table).__setResult({ data });
    await expect(write()).rejects.toMatchObject({ code: '42501' });
  });

  it('throws the query error as is', async () => {
    mockTable(table).__setResult({ error: queryError });
    await expect(write()).rejects.toBe(queryError);
  });
});

describe('setMemberRole', () => {
  it(`changes only that member's role on that trip`, async () => {
    mockTable('trip_members').__setResult({ data: [{ user_id: 'user-2' }] });

    await setMemberRole(7, 'user-2', 'viewer');

    const members = mockTable('trip_members');
    expect(members.update).toHaveBeenCalledWith({ role: 'viewer' });
    expect(members.eq).toHaveBeenCalledWith('trip_id', 7);
    expect(members.eq).toHaveBeenCalledWith('user_id', 'user-2');
    expect(members.select).toHaveBeenCalledWith('user_id');
  });
});

describe('removeTripMember', () => {
  it('deletes only that member from that trip', async () => {
    mockTable('trip_members').__setResult({ data: [{ user_id: 'user-2' }] });

    await removeTripMember(7, 'user-2');

    const members = mockTable('trip_members');
    expect(members.delete).toHaveBeenCalled();
    expect(members.eq).toHaveBeenCalledWith('trip_id', 7);
    expect(members.eq).toHaveBeenCalledWith('user_id', 'user-2');
    expect(members.select).toHaveBeenCalledWith('user_id');
  });
});

describe('deleteTrip', () => {
  it('deletes only that trip', async () => {
    mockTable('trips').__setResult({ data: [{ id: 7 }] });

    await deleteTrip(7);

    expect(mockTable('trips').delete).toHaveBeenCalled();
    expect(mockTable('trips').eq).toHaveBeenCalledWith('id', 7);
    expect(mockTable('trips').select).toHaveBeenCalledWith('id');
  });
});

describe.each([
  {
    name: 'transferTripOwnership',
    call: () => transferTripOwnership(7, 'user-2'),
    fn: 'transfer_trip_ownership',
    args: { target_trip_id: 7, new_owner_id: 'user-2' },
  },
  { name: 'leaveTrip', call: () => leaveTrip(7), fn: 'leave_trip', args: { target_trip_id: 7 } },
  { name: 'cancelTrip', call: () => cancelTrip(7), fn: 'cancel_trip', args: { target_trip_id: 7 } },
])('$name', ({ call, fn, args }) => {
  it(`calls ${fn} with the argument names it declares`, async () => {
    await expect(call()).resolves.toBeUndefined();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(fn, args);
  });

  it('throws the error the function raised', async () => {
    const denied = { code: '42501', message: 'only owner can do that' };
    mockRpc(fn, { error: denied });

    await expect(call()).rejects.toBe(denied);
  });
});
