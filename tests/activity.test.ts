import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { activityDay, dayGoalEvents, rollingHabitScore } from '../src/lib/activity';
import { createStore } from '../src/lib/database';
import {
  addDays,
  emptyDay,
  initialData,
  reviseHabit,
  scheduled,
  type GoalEvent,
} from '../src/lib/model';
const today = '2026-12-01';
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
  assert.equal(s.percent, 60);
  assert.equal(s.untracked, 0);
  hit(d, addDays(start, -1));
  hit(d, addDays(today, 1));
  assert.equal(rollingHabitScore(d, today).percent, 60);
});
test('new gardens show honest coverage and only fully completed habits earn daily credit', () => {
  const d = smallGarden(today);
  d.days[today] = { ...emptyDay(), logs: { journal: 1, focus: 59 } };
  let s = rollingHabitScore(d, today);
  assert.equal(s.eligible, 1);
  assert.equal(s.percent, 50);
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
  assert.equal(s.eligible, 2);
  assert.equal(s.percent, 75);
  assert.equal(activityDay(d, yesterday, today).hit, true);
});

test('the scoring period starts on 2 November while 1 November remains tracked', () => {
  const d = smallGarden('2026-11-01');
  hit(d, '2026-11-01');
  d.days['2026-11-02'] = { ...emptyDay(), logs: { journal: 1 } };
  const score = rollingHabitScore(d, '2026-11-03');
  assert.equal(score.scoringStart, '2026-11-02');
  assert.equal(score.eligible, 2);
  assert.equal(score.tracked, 2);
  assert.equal(score.percent, 25);
  assert.equal(activityDay(d, '2026-11-01', '2026-11-03').tracked, true);
  assert.equal(rollingHabitScore(d, '2026-11-01').percent, null);
  const later = smallGarden('2026-11-03');
  hit(later, '2026-11-03');
  assert.equal(rollingHabitScore(later, '2026-11-04').percent, 50);
  assert.equal(rollingHabitScore(later, '2026-11-04').scoringStart, '2026-11-03');
});

test('days with different numbers of scheduled habits receive equal weight', () => {
  const yesterday = addDays(today, -1),
    d = smallGarden(yesterday);
  d.days[yesterday] = { ...emptyDay(), logs: { journal: 1 } };
  d.days[today] = { ...emptyDay(), logs: { journal: 1 } };
  const focus = d.habits.find((h) => h.id === 'focus')!;
  reviseHabit(focus, { ...focus.revisions[0], paused: true }, today);
  const score = rollingHabitScore(d, today);
  assert.equal(score.eligible, 2);
  assert.equal(score.percent, 75); // mean(1/2, 1/1), not pooled 2/3
});

test('daily fractions are not rounded before calculating the mean', () => {
  const yesterday = addDays(today, -1),
    d = initialData(yesterday);
  d.habits = d.habits.filter((h) => ['journal', 'focus', 'food'].includes(h.id));
  d.days[yesterday] = { ...emptyDay(), logs: { journal: 1 } };
  assert.equal(rollingHabitScore(d, today).percent, 16.7); // mean(1/3, 0), not mean(33%, 0%)
});

test('check-offs, undo, historical target edits and excused status recalculate the average', () => {
  const yesterday = addDays(today, -1),
    d = smallGarden(yesterday);
  d.days[yesterday] = { ...emptyDay(), logs: { journal: 1 } };
  d.days[today] = emptyDay();
  assert.equal(rollingHabitScore(d, today).percent, 25);
  d.days[yesterday].logs.focus = 60;
  assert.equal(rollingHabitScore(d, today).percent, 50);
  d.days[today].logs.journal = 1;
  assert.equal(rollingHabitScore(d, today).percent, 75);
  d.days[yesterday].logs.journal = 0;
  assert.equal(rollingHabitScore(d, today).percent, 50);
  const focus = d.habits.find((h) => h.id === 'focus')!;
  reviseHabit(focus, { ...focus.revisions[0], target: 90 }, yesterday, 'day');
  assert.equal(rollingHabitScore(d, today).percent, 25);
  d.days[today].logs.focus = 'rest';
  assert.equal(rollingHabitScore(d, today).percent, 50);
  d.days[yesterday].logs = { journal: 'rest', focus: 'rest' };
  assert.equal(rollingHabitScore(d, today).eligible, 1);
  assert.equal(rollingHabitScore(d, today).percent, 100);
});

test('off-day habits and goals do not contribute to the average', () => {
  const d = smallGarden(today);
  const focus = d.habits.find((h) => h.id === 'focus')!;
  focus.revisions[0].days = [0]; // today is Tuesday
  d.days[today] = { ...emptyDay(), logs: { focus: 60 } };
  d.goals[0].status = 'Achieved';
  assert.equal(rollingHabitScore(d, today).percent, 0);
  d.days[today].logs.journal = 1;
  assert.equal(rollingHabitScore(d, today).percent, 100);
});

test('corrected historical scores survive saving and reopening SQLite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-score-test-'));
  let store = createStore(dir);
  try {
    const data = smallGarden(addDays(today, -1));
    data.days[addDays(today, -1)] = { ...emptyDay(), logs: { journal: 1 } };
    data.days[today] = { ...emptyDay(), logs: { journal: 1, focus: 60 } };
    store.save(data, store.read().revision);
    store.close();
    store = createStore(dir);
    assert.equal(rollingHabitScore(store.read().data, today).percent, 75);
    const saved = store.read();
    saved.data.days[addDays(today, -1)].logs.focus = 60;
    store.save(saved.data, saved.revision);
    store.close();
    store = createStore(dir);
    assert.equal(rollingHabitScore(store.read().data, today).percent, 100);
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
