// Manual mock for the app's Supabase singleton.
//
// Jest only auto-applies __mocks__ for node_modules packages, so this file does nothing
// on its own - jest.setup.ts registers it globally with jest.mock('@/src/lib/supabase').
//
// `jest` is imported rather than read off the global: the project has no @types/jest, so
// @jest/globals is the single source of both the runtime helpers and their types.
import { jest } from '@jest/globals';

type Result<T = unknown> = { data: T; error: unknown };

const emptyResult = (): Result => ({ data: null, error: null });

/** Chainable builder methods return the builder itself, whatever they're passed. */
type ChainFn = jest.Mock<(...args: unknown[]) => QueryBuilderMock>;

export interface QueryBuilderMock {
  select: ChainFn;
  insert: ChainFn;
  update: ChainFn;
  upsert: ChainFn;
  delete: ChainFn;
  eq: ChainFn;
  single: ChainFn;
  then: <R1 = Result, R2 = never>(
    resolve?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    reject?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ) => Promise<R1 | R2>;
  /** Stage what awaiting this builder resolves to. Call before the code under test runs. */
  __setResult: (next: Partial<Result>) => void;
}

const makeQueryBuilder = (): QueryBuilderMock => {
  let result = emptyResult();
  const chain = (): ChainFn => jest.fn((..._args: unknown[]) => builder);
  const builder: QueryBuilderMock = {
    select: chain(),
    insert: chain(),
    update: chain(),
    upsert: chain(),
    delete: chain(),
    eq: chain(),
    single: chain(),
    // A real builder is a thenable, not a promise: awaiting it is what runs the query.
    // Forwarding `reject` too keeps .catch()/.finally() working alongside await.
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    __setResult: (next) => {
      result = { ...result, ...next };
    },
  };
  return builder;
};

export interface StorageBucketMock {
  upload: jest.Mock<(path: string, ...rest: unknown[]) => Promise<Result<{ path: string }>>>;
  remove: jest.Mock<(...args: unknown[]) => Promise<Result<unknown[]>>>;
  getPublicUrl: jest.Mock<(path: string) => { data: { publicUrl: string } }>;
}

const makeStorageBucket = (bucket: string): StorageBucketMock => ({
  upload: jest.fn(async (path: string) => ({ data: { path }, error: null })),
  remove: jest.fn(async () => ({ data: [] as unknown[], error: null })),
  // Echoes the bucket it was created for, so avatarUrl() can be asserted against a real URL.
  getPublicUrl: jest.fn((path: string) => ({
    data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` },
  })),
});

// Memoised per table/bucket/function name rather than per call: a test needs to stage a
// result *before* the code under test calls from(), and inspect the same spy afterwards.
// resetSupabaseMock() drops these between tests so nothing leaks across cases.
const builders = new Map<string, QueryBuilderMock>();
const buckets = new Map<string, StorageBucketMock>();
const rpcResults = new Map<string, Result>();

const memo = <T>(map: Map<string, T>, key: string, make: (key: string) => T): T => {
  const existing = map.get(key);
  if (existing) return existing;
  const created = make(key);
  map.set(key, created);
  return created;
};

/** Handle on the builder that `supabase.from(table)` will return. */
export const mockTable = (table: string) => memo(builders, table, makeQueryBuilder);

/** Handle on the bucket that `supabase.storage.from(bucket)` will return. */
export const mockBucket = (bucket: string) => memo(buckets, bucket, makeStorageBucket);

/** Stage what `supabase.rpc(fn, ...)` resolves to. Unstaged calls resolve to null/null. */
export const mockRpc = (fn: string, result: Partial<Result>) =>
  rpcResults.set(fn, { ...emptyResult(), ...result });

type SessionResult = Result<{ session: unknown }>;
type UserResult = Result<{ user: unknown; session: unknown }>;
type Subscription = { data: { subscription: { unsubscribe: jest.Mock<() => void> } } };

const auth = {
  getSession: jest.fn<(...args: unknown[]) => Promise<SessionResult>>(),
  onAuthStateChange: jest.fn<(...args: unknown[]) => Subscription>(),
  signUp: jest.fn<(...args: unknown[]) => Promise<UserResult>>(),
  signInWithPassword: jest.fn<(...args: unknown[]) => Promise<UserResult>>(),
  signOut: jest.fn<(...args: unknown[]) => Promise<Result<null>>>(),
};

// One shared unsubscribe spy per reset, so a test can assert the AuthProvider cleanup ran.
const applyAuthDefaults = () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn<() => void>() } },
  });
  auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  auth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
  auth.signOut.mockResolvedValue({ data: null, error: null });
};

applyAuthDefaults();

export const supabase = {
  from: jest.fn((table: string) => mockTable(table)),
  rpc: jest.fn(async (fn: string, ..._args: unknown[]) => rpcResults.get(fn) ?? emptyResult()),
  auth,
  storage: { from: jest.fn((bucket: string) => mockBucket(bucket)) },
};

/**
 * Clears every spy and staged result. jest.setup.ts calls this in a global beforeEach,
 * so tests start from the defaults above. Deliberately not jest config's `resetMocks`:
 * that would also wipe the default implementations set at module load.
 */
export const resetSupabaseMock = () => {
  builders.clear();
  buckets.clear();
  rpcResults.clear();
  supabase.from.mockClear();
  supabase.rpc.mockClear();
  supabase.storage.from.mockClear();
  auth.getSession.mockReset();
  auth.onAuthStateChange.mockReset();
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.signOut.mockReset();
  applyAuthDefaults();
};
