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

// Calendar days in the phone's time zone. Steps are whole dates, not 24 hours, so a daylight
// saving change can't skip or repeat a day
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Rounded because a day with a daylight saving change is 23 or 25 hours long
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

// "Sat, Sep 12", in the phone's locale
export const formatShortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
