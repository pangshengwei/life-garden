import test from 'node:test';
import assert from 'node:assert/strict';
import { activityDay, dayGoalEvents, rollingHabitScore } from '../src/lib/activity';
import { addDays, emptyDay, initialData, scheduled, type GoalEvent } from '../src/lib/model';
const today = '2026-11-03';
function smallGarden(start: string) {
  const d = initialData(start);
  d.habits = d.habits.filter((h) => ['journal', 'focus'].includes(h.id));
  return d;
}
function hit(d: ReturnType<typeof initialData>, date: string) {
  d.days[date] = emptyDay();
  for (const h of scheduled(d, date)) d.days[date].logs[h.id] = h.target;
}
test('30-day score uses exact calendar window and includes missing tracked days', () => {
  const start = addDays(today, -29),
    d = smallGarden(start);
  for (let i = 0; i < 18; i++) hit(d, addDays(start, i));
  const s = rollingHabitScore(d, today);
  assert.equal(s.start, start);
  assert.equal(s.end, today);
  assert.equal(s.eligible, 30);
  assert.equal(s.hits, 18);
  assert.equal(s.percent, 60);
  assert.equal(s.untracked, 0);
  hit(d, addDays(start, -1));
  assert.equal(rollingHabitScore(d, today).hits, 18);
});
test('new gardens show honest coverage and partial numeric logs do not hit the day', () => {
  const d = smallGarden(today);
  d.days[today] = { ...emptyDay(), logs: { journal: 1, focus: 59 } };
  let s = rollingHabitScore(d, today);
  assert.equal(s.eligible, 1);
  assert.equal(s.percent, 0);
  assert.equal(s.untracked, 29);
  d.days[today].logs.focus = 60;
  s = rollingHabitScore(d, today);
  assert.equal(s.percent, 100);
  assert.equal(activityDay(d, addDays(today, -1), today).tracked, false);
});
test('rest exclusions never make an empty day a perfect day', () => {
  const start = addDays(today, -2),
    d = smallGarden(start);
  hit(d, start);
  d.days[addDays(start, 1)] = { ...emptyDay(), logs: { journal: 'rest', focus: 'rest' } };
  d.days[today] = { ...emptyDay(), logs: { journal: 1, focus: 'rest' } };
  const s = rollingHabitScore(d, today);
  assert.equal(s.eligible, 2);
  assert.equal(s.hits, 2);
  assert.equal(s.percent, 100);
  assert.equal(s.restDays, 1);
  assert.equal(activityDay(d, addDays(start, 1), today).hit, false);
  d.habits = [];
  assert.equal(rollingHabitScore(d, today).percent, null);
});
test('board intensity increases with real completions and deduplicates corrected goal updates', () => {
  const d = smallGarden(today);
  hit(d, today);
  const event: GoalEvent = {
    id: 'event-a',
    goalId: 'starter-startup',
    date: today,
    title: 'A useful experiment',
    category: 'startup',
    previous: 0,
    current: 1,
    target: 1,
    unit: 'outcome',
    achieved: true,
    wasAchieved: false,
  };
  d.goalEvents = [event, { ...event, id: 'event-b', previous: 1, current: 2, wasAchieved: true }];
  let a = activityDay(d, today, today);
  assert.equal(a.done, 2);
  assert.equal(a.achieved, 1);
  assert.equal(a.count, 3);
  assert.equal(a.intensity, 2);
  d.goalEvents.push({ ...event, id: 'event-c', current: 0, achieved: false, wasAchieved: true });
  assert.equal(activityDay(d, today, today).achieved, 0);
  d.goalEvents.push({ ...event, id: 'event-d', date: addDays(today, 1), wasAchieved: true });
  assert.equal(dayGoalEvents(d, addDays(today, 1))[0].achieved, false);
  assert.equal(activityDay(d, addDays(today, 1), today).count, 0);
});
test('habit targets are evaluated using each date’s historical schedule', () => {
  const yesterday = addDays(today, -1),
    d = smallGarden(yesterday);
  hit(d, yesterday);
  const h = d.habits.find((h) => h.id === 'focus')!;
  h.revisions.push({ ...h.revisions[0], from: today, target: 90 });
  d.days[today] = { ...emptyDay(), logs: { journal: 1, focus: 60 } };
  const s = rollingHabitScore(d, today);
  assert.equal(s.hits, 1);
  assert.equal(s.eligible, 2);
  assert.equal(s.percent, 50);
  assert.equal(activityDay(d, yesterday, today).hit, true);
});
