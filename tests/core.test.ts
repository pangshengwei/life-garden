import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createStore, ConflictError } from '../src/lib/database';
import {
  addDays,
  dateKey,
  dayScore,
  emptyDay,
  initialData,
  scheduled,
  totalXP,
  weekDates,
} from '../src/lib/model';
import { dataSchema } from '../src/lib/validation';
const today = '2026-11-03';
test('Singapore date rollover and weekly boundaries are stable', () => {
  assert.equal(dateKey(new Date('2026-11-02T16:01:00Z')), today);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(weekDates(today), [
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
  ]);
});
test('public starter has no invented activity or private financial balances', () => {
  const d = initialData(today);
  assert.deepEqual(d.days, {});
  assert.equal(d.sessions.length, 0);
  assert.deepEqual(d.finance, []);
  assert.ok(d.goals.every((g) => g.current === 0 && g.status === 'Aspirational'));
  assert.equal(dataSchema.safeParse(d).success, true);
});
test('recovery and schedule changes preserve historical denominators', () => {
  const d = initialData(today);
  d.days[today] = emptyDay();
  const before = dayScore(d, today);
  d.days[today].logs.sleep = 'rest';
  assert.equal(dayScore(d, today).total, before.total - 1);
  const h = d.habits.find((h) => h.id === 'focus')!;
  h.revisions.push({ ...h.revisions[0], from: '2026-11-04', paused: true });
  assert.ok(scheduled(d, today).some((h) => h.id === 'focus'));
  assert.ok(!scheduled(d, '2026-11-04').some((h) => h.id === 'focus'));
  assert.equal(scheduled(d, '2026-11-02').length, 0);
});
test('numeric target and reversible completions do not farm XP', () => {
  const d = initialData(today);
  d.days[today] = emptyDay();
  const base = totalXP(d);
  d.days[today].logs.focus = 30;
  assert.equal(totalXP(d), base);
  d.days[today].logs.focus = 60;
  assert.equal(totalXP(d), base + 10);
  d.days[today].logs.focus = 0;
  assert.equal(totalXP(d), base);
  d.days[today].logs.focus = 60;
  assert.equal(totalXP(d), base + 10);
  d.sessions.push(
    { id: 'a', date: today, seconds: 100, output: 'A useful result', category: 'career' },
    { id: 'b', date: today, seconds: 100, output: 'Another result', category: 'career' },
  );
  assert.equal(totalXP(d), base + 30);
});
test('backup validation rejects malformed, duplicate, and cyclic records', () => {
  const d = initialData(today);
  d.finance.push({
    id: 'fixture',
    date: today,
    liquid: 100,
    accessible: 200,
    netWorth: 300,
    securities: null,
    property: null,
    etf: null,
    contributions: null,
    notes: '',
  });
  assert.equal(dataSchema.safeParse(d).success, false);
  const a = initialData(today);
  a.habits.push(a.habits[0]);
  assert.equal(dataSchema.safeParse(a).success, false);
  const b = initialData(today);
  b.goals[0].parentId = b.goals[1].id;
  b.goals[1].parentId = b.goals[0].id;
  assert.equal(dataSchema.safeParse(b).success, false);
  const c = initialData(today);
  c.finance.push({
    id: 'fixture',
    date: '2026-02-30',
    liquid: 100,
    accessible: 50,
    netWorth: 300,
    securities: null,
    property: null,
    etf: null,
    contributions: null,
    notes: '',
  });
  assert.equal(dataSchema.safeParse(c).success, false);
});
test('SQLite survives reopen, protects conflicting writers, and mirrors annotations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-test-'));
  let store = createStore(dir);
  try {
    const first = store.read();
    first.data.days[today] = {
      ...emptyDay(),
      priority: 'A persistent intention',
      wins: 'A small win',
      logs: { journal: 1 },
    };
    const result = store.save(first.data, first.revision);
    assert.equal(result.mirrorError, null);
    const sql = new Database(store.dbPath, { readonly: true });
    try {
      assert.equal(
        (
          sql.prepare('SELECT priority FROM daily_notes WHERE date = ?').get(today) as {
            priority: string;
          }
        ).priority,
        'A persistent intention',
      );
      assert.equal(
        (
          sql
            .prepare('SELECT value FROM habit_logs WHERE date = ? AND habit_id = ?')
            .get(today, 'journal') as { value: number }
        ).value,
        1,
      );
    } finally {
      sql.close();
    }
    const log = path.join(result.mirrorPath, 'Habit logs', `LG-log-${today}-journal.md`);
    assert.match(fs.readFileSync(log, 'utf8'), /completed: true/);
    assert.match(fs.readFileSync(log, 'utf8'), /type: "habit-log"/);

    const note = path.join(result.mirrorPath, 'Daily', today + '.md');
    assert.match(fs.readFileSync(note, 'utf8'), /priority|persistent intention/);
    fs.appendFileSync(note, '\nMy own Obsidian annotation.\n');
    assert.throws(() => store.save(first.data, first.revision), ConflictError);
    first.data.days[today].priority = 'Updated';
    store.save(first.data, result.revision);
    assert.match(fs.readFileSync(note, 'utf8'), /My own Obsidian annotation/);
    store.close();
    store = createStore(dir);
    assert.equal(store.read().data.days[today].priority, 'Updated');
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('mirror failures keep committed SQLite data safe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-test-'));
  const store = createStore(dir);
  try {
    fs.mkdirSync(store.mirrorPath, { recursive: true });
    fs.writeFileSync(path.join(store.mirrorPath, 'Life Garden.md'), 'My pre-existing note');
    const row = store.read();
    row.data.days[today] = { ...emptyDay(), notes: 'Durable even if the vault is unavailable' };
    const result = store.save(row.data, row.revision);
    assert.ok(result.mirrorError);
    assert.equal(store.read().data.days[today].notes, row.data.days[today].notes);
    assert.equal(
      fs.readFileSync(path.join(store.mirrorPath, 'Life Garden.md'), 'utf8'),
      'My pre-existing note',
    );
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('dated goal history persists in SQLite and Obsidian without requiring old backups to contain it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-test-'));
  const store = createStore(dir);
  try {
    const row = store.read();
    const g = row.data.goals[0];
    row.data.goalEvents = [
      {
        id: 'event-one',
        goalId: g.id,
        date: today,
        title: g.title,
        category: g.category,
        previous: 0,
        current: 1,
        target: 1,
        unit: 'outcome',
        achieved: true,
        wasAchieved: false,
      },
    ];
    const result = store.save(row.data, row.revision);
    assert.equal(result.mirrorError, null);
    assert.equal(store.read().data.goalEvents?.[0].date, today);
    const sql = new Database(store.dbPath, { readonly: true });
    try {
      assert.equal(
        (
          sql.prepare('SELECT date FROM goal_events WHERE id=?').get('event-one') as {
            date: string;
          }
        ).date,
        today,
      );
    } finally {
      sql.close();
    }
    assert.match(
      fs.readFileSync(
        path.join(store.mirrorPath, 'Goal progress', 'LG-goal-event-event-one.md'),
        'utf8',
      ),
      /was_achieved: false/,
    );
    delete row.data.goalEvents;
    assert.deepEqual(dataSchema.parse(row.data).goalEvents, []);
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
