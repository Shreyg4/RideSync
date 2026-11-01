/**
 * @file assertChanged.ts
 * @description Shared check for writes that RLS may have quietly skipped
 */

// RLS turns a write the caller isn't allowed to make into a silent no-op, so zero rows means denied
export const assertChanged = (rows: readonly unknown[] | null) => {
  if (!rows?.length) throw Object.assign(new Error('nothing was changed'), { code: '42501' });
};
