import type { GardenData } from './model';

export const TRACKING_START = '2026-11-01';

/** Extend the original tracking plan without rewriting later habit revisions or logs. */
export function backdateTrackingStart(data: GardenData) {
  if (data.startedOn <= TRACKING_START) return false;
  const previousStart = data.startedOn;
  data.startedOn = TRACKING_START;
  for (const habit of data.habits) {
    const first = habit.revisions[0];
    // Habits introduced later keep their own start; they can be added to a past
    // day explicitly with the existing "Add to this day" control.
    if (first.from === previousStart)
      habit.revisions.unshift({ ...first, days: [...first.days], from: TRACKING_START });
  }
  return true;
}
