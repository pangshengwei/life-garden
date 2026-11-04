import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createStore } from '../src/lib/database';
import {
  definition,
  emptyDay,
  initialData,
  includeHabitOnDate,
  habitAvailability,
  reviseHabit,
  scheduled,
  setHabitArchived,
} from '../src/lib/model';
import { dataSchema } from '../src/lib/validation';

test('renaming a habit preserves earlier names, schedule and logs', () => {
  const d = initialData('2026-11-02');
  const h = d.habits.find((h) => h.id === 'journal')!;
  d.days['2026-11-02'] = { ...emptyDay(), logs: { journal: 1 } };
  reviseHabit(h, { ...h.revisions[0], name: 'A quiet morning journal' }, '2026-11-03');
  assert.equal(definition(h, '2026-11-02')?.name, 'Morning journal');
  assert.equal(definition(h, '2026-11-03')?.name, 'A quiet morning journal');
  assert.equal(d.days['2026-11-02'].logs.journal, 1);
});
test('remove and restore exclude the removed period without deleting earlier history', () => {
  const d = initialData('2026-11-02');
  const h = d.habits.find((h) => h.id === 'journal')!;
  d.days['2026-11-02'] = { ...emptyDay(), logs: { journal: 1 } };
  setHabitArchived(h, true, '2026-11-03');
  assert.equal(h.archived, true);
  assert.ok(scheduled(d, '2026-11-02').some((h) => h.id === 'journal'));
  assert.ok(!scheduled(d, '2026-11-03').some((h) => h.id === 'journal'));
  assert.equal(dataSchema.parse(d).habits.find((x) => x.id === h.id)?.archived, true);
  setHabitArchived(h, false, '2026-11-05');
  assert.equal(h.archived, false);
  assert.ok(!scheduled(d, '2026-11-04').some((h) => h.id === 'journal'));
  assert.ok(scheduled(d, '2026-11-05').some((h) => h.id === 'journal'));
  assert.equal(d.days['2026-11-02'].logs.journal, 1);
});
test('existing SQLite databases migrate habit removal without losing rows and mirror its state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-habit-test-'));
  const data = initialData('2026-11-02');
  const habit = data.habits[0],
    revision = habit.revisions[0];
  const old = new Database(path.join(dir, 'life-garden.sqlite'));
  old.exec(
    'CREATE TABLE app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE habits (id TEXT PRIMARY KEY,name TEXT,category TEXT,type TEXT,target REAL,paused INTEGER,revisions_json TEXT);',
  );
  old.prepare('INSERT INTO app_state VALUES (1,0,?)').run(JSON.stringify(data));
  old
    .prepare('INSERT INTO habits VALUES (?,?,?,?,?,?,?)')
    .run(
      habit.id,
      revision.name,
      revision.category,
      revision.type,
      revision.target,
      0,
      JSON.stringify(habit.revisions),
    );
  old.close();
  const store = createStore(dir);
  try {
    const sql = new Database(store.dbPath);
    try {
      assert.equal(
        (
          sql.prepare('SELECT name,archived FROM habits WHERE id=?').get(habit.id) as {
            name: string;
            archived: number;
          }
        ).name,
        revision.name,
      );
    } finally {
      sql.close();
    }
    const row = store.read();
    setHabitArchived(row.data.habits[0], true, '2026-11-03');
    store.save(row.data, row.revision);
    assert.equal(store.read().data.habits[0].archived, true);
    const check = new Database(store.dbPath);
    try {
      assert.equal(
        (
          check.prepare('SELECT archived FROM habits WHERE id=?').get(habit.id) as {
            archived: number;
          }
        ).archived,
        1,
      );
    } finally {
      check.close();
    }
    assert.match(
      fs.readFileSync(path.join(store.mirrorPath, 'Habits', `LG-habit-${habit.id}.md`), 'utf8'),
      /archived: true/,
    );
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('backdated revisions preserve explicit later edits instead of discarding them', () => {
  const d = initialData('2026-11-03'),
    h = d.habits[0];
  reviseHabit(h, { ...h.revisions[0], name: 'Current name' }, '2026-11-04');
  reviseHabit(h, { ...h.revisions[0], name: 'Corrected earlier name' }, '2026-11-03');
  assert.equal(definition(h, '2026-11-03')?.name, 'Corrected earlier name');
  assert.equal(definition(h, '2026-11-04')?.name, 'Current name');
  assert.equal(h.revisions.length, 2);
  assert.equal(dataSchema.safeParse(d).success, true);
});
test('one-day historical corrections restore the next day and retain later scheduled changes', () => {
  const d = initialData('2026-11-01'),
    h = d.habits[0];
  reviseHabit(h, { ...h.revisions[0], name: 'Next week name' }, '2026-11-08');
  reviseHabit(h, { ...h.revisions[0], name: 'One-day correction', target: 2 }, '2026-11-03', 'day');
  assert.equal(definition(h, '2026-11-02')?.name, 'Sufficient sleep');
  assert.equal(definition(h, '2026-11-03')?.target, 2);
  assert.equal(definition(h, '2026-11-04')?.target, 1);
  assert.equal(definition(h, '2026-11-08')?.name, 'Next week name');
  assert.equal(dataSchema.safeParse(d).success, true);
});
test('including a current weekly plan on an earlier date does not rewrite the recurring schedule', () => {
  const d = initialData('2026-11-03'),
    h = d.habits.find((h) => h.id === 'cardio')!;
  reviseHabit(h, { ...h.revisions[0], name: 'Zone 2 cardio', days: [2], target: 60 }, '2026-11-04');
  assert.equal(habitAvailability(h, '2026-11-03'), 'off-day');
  assert.equal(habitAvailability(h, '2026-11-04'), 'off-day');
  includeHabitOnDate(h, '2026-11-03', '2026-11-04');
  assert.equal(habitAvailability(h, '2026-11-03'), 'scheduled');
  assert.equal(definition(h, '2026-11-03')?.name, 'Zone 2 cardio');
  assert.equal(definition(h, '2026-11-03')?.target, 60);
  assert.deepEqual(definition(h, '2026-11-04')?.days, [2]);
  assert.equal(habitAvailability(h, '2026-11-04'), 'off-day');
  assert.equal(dataSchema.safeParse(d).success, true);
});
test('adding a not-yet-started habit to a historical date restores the gap before its start', () => {
  const d = initialData('2026-11-01'),
    h = d.habits[0];
  h.revisions[0].from = '2026-11-08';
  assert.equal(habitAvailability(h, '2026-11-03'), 'not-started');
  includeHabitOnDate(h, '2026-11-03', '2026-11-08');
  assert.equal(habitAvailability(h, '2026-11-03'), 'scheduled');
  assert.equal(habitAvailability(h, '2026-11-04'), 'paused');
  assert.equal(habitAvailability(h, '2026-11-08'), 'scheduled');
  assert.equal(dataSchema.safeParse(d).success, true);
});
test('removing a habit for a past date does not archive or pause the current habit', () => {
  const d = initialData('2026-11-01'),
    h = d.habits[0];
  setHabitArchived(h, true, '2026-11-03', 'day');
  assert.equal(!!h.archived, false);
  assert.equal(habitAvailability(h, '2026-11-03'), 'paused');
  assert.equal(habitAvailability(h, '2026-11-04'), 'scheduled');
});
test('a one-day edit immediately before an existing revision does not replace that revision', () => {
  const d = initialData('2026-11-01'),
    h = d.habits[0];
  reviseHabit(h, { ...h.revisions[0], target: 7, name: 'New current settings' }, '2026-11-04');
  const next = structuredClone(h.revisions[1]);
  reviseHabit(h, { ...h.revisions[0], target: 2 }, '2026-11-03', 'day');
  assert.deepEqual(
    h.revisions.find((r) => r.from === '2026-11-04'),
    next,
  );
  assert.equal(definition(h, '2026-11-03')?.target, 2);
});
