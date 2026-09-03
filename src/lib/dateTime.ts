export type DateTimePart = 'date' | 'time';

export const mergeDateTime = (
  previous: Date | null,
  picked: Date,
  part: DateTimePart,
  now: Date = new Date()
): Date => {
  const next = new Date(previous ?? now);
  if (part === 'date') {
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  } else {
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  }
  return next;
};
