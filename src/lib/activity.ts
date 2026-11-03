import { addDays, dayScore, type GardenData, type GoalEvent } from './model';

/** The last correction for a goal on a date determines that date's achievement. */
export function dayGoalEvents(data: GardenData, date: string): GoalEvent[] {
  const last = new Map<string, GoalEvent>();
  const events = (data.goalEvents || []).filter((event) => event.date === date);
  for (const event of events) last.set(event.goalId, event);
  return [...last.values()].map((event) => ({
    ...event,
    achieved:
      event.achieved &&
      events.some((e) => e.goalId === event.goalId && e.achieved && !e.wasAchieved),
  }));
}
export function activityDay(data: GardenData, date: string, today: string) {
  const tracked = date >= data.startedOn && date <= today;
  const habits = dayScore(data, date);
  const goals = dayGoalEvents(data, date);
  const achieved = goals.filter((g) => g.achieved).length;
  const count = tracked ? habits.done + achieved : 0;
  return {
    date,
    tracked,
    ...habits,
    achieved,
    count,
    hit: tracked && habits.total > 0 && habits.done === habits.total,
    intensity: !count ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4,
  };
}
export function rollingHabitScore(data: GardenData, today: string) {
  const start = addDays(today, -29);
  const days = Array.from({ length: 30 }, (_, i) => activityDay(data, addDays(start, i), today));
  const tracked = days.filter((d) => d.tracked);
  const eligible = tracked.filter((d) => d.total > 0);
  const hits = eligible.filter((d) => d.hit).length;
  return {
    start,
    end: today,
    days,
    hits,
    eligible: eligible.length,
    tracked: tracked.length,
    untracked: 30 - tracked.length,
    restDays: tracked.length - eligible.length,
    percent: eligible.length ? Math.round((hits / eligible.length) * 100) : null,
  };
}
