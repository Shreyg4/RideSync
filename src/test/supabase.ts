import * as supabaseModule from '@/src/lib/supabase';

const mock = supabaseModule as unknown as typeof import('@/src/lib/__mocks__/supabase');

export const { mockTable, mockBucket, mockRpc } = mock;
