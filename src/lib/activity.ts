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
export const HABIT_SCORE_START = '2026-11-02';

export function rollingHabitScore(data: GardenData, today: string) {
  const start = addDays(today, -29);
  const scoringStart = [start, data.startedOn, HABIT_SCORE_START].sort().at(-1)!;
  const days = Array.from({ length: 30 }, (_, i) => activityDay(data, addDays(start, i), today));
  const tracked = days.filter((d) => d.tracked && d.date >= scoringStart);
  const eligible = tracked.filter((d) => d.total > 0);
  // Each day has equal weight. Average the exact fractions, not rounded daily
  // percentages or pooled completions across days with different habit counts.
  const completionSum = eligible.reduce((sum, day) => sum + day.done / day.total, 0);
  return {
    start,
    scoringStart,
    end: today,
    days,
    eligible: eligible.length,
    tracked: tracked.length,
    untracked: 30 - tracked.length,
    restDays: tracked.length - eligible.length,
    percent: eligible.length ? Math.round((completionSum / eligible.length) * 1000) / 10 : null,
  };
}
