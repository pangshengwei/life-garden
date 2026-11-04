import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ConflictError, createStore } from '../src/lib/database';
import { activityDay } from '../src/lib/activity';
import { definition, emptyDay, initialData, reviseHabit, scheduled } from '../src/lib/model';
import { dataSchema } from '../src/lib/validation';

test('existing gardens unlock 1–3 November without losing history or later habit settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-tracking-test-'));
  const original = initialData('2026-11-04');
  original.days['2026-11-04'] = { ...emptyDay(), notes: 'Keep this note', logs: { journal: 1 } };
  const habit = original.habits.find((h) => h.id === 'journal')!;
  reviseHabit(habit, { ...habit.revisions[0], name: 'Later journal', target: 2 }, '2026-11-05');
  original.habits.push({
    id: 'later-habit',
    revisions: [{ ...habit.revisions[0], from: '2026-11-06' }],
  });
  const db = new Database(path.join(dir, 'life-garden.sqlite'));
  db.exec(
    'CREATE TABLE app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL)',
  );
  db.prepare('INSERT INTO app_state VALUES (1,7,?)').run(JSON.stringify(original));
  db.close();
  let store: ReturnType<typeof createStore> | undefined;
  try {
    store = createStore(dir);
    const migrated = store.read();
    assert.equal(migrated.data.startedOn, '2026-11-01');
    assert.equal(migrated.revision, 8);
    assert.equal(dataSchema.safeParse(migrated.data).success, true);
    assert.deepEqual(migrated.data.days, original.days);
    assert.deepEqual(migrated.data.goals, original.goals);
    assert.deepEqual(migrated.data.finance, original.finance);
    const journal = migrated.data.habits.find((h) => h.id === 'journal')!;
    assert.deepEqual(journal.revisions.slice(1), habit.revisions);
    assert.equal(definition(journal, '2026-11-05')?.target, 2);
    assert.equal(definition(migrated.data.habits.at(-1)!, '2026-11-03'), undefined);
    for (const date of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      assert.equal(activityDay(migrated.data, date, '2026-11-04').tracked, true);
      assert.ok(scheduled(migrated.data, date).some((h) => h.id === 'journal'));
      assert.equal(migrated.data.days[date], undefined);
      reviseHabit(
        journal,
        { ...definition(journal, date)!, name: `Journal on ${date}` },
        date,
        'day',
      );
      migrated.data.days[date] = { ...emptyDay(), logs: { journal: 1 } };
    }
    assert.equal(activityDay(migrated.data, '2026-10-31', '2026-11-04').tracked, false);
    assert.throws(() => store!.save(original, 7), ConflictError);
    const saved = store.save(migrated.data, migrated.revision);
    assert.equal(saved.mirrorError, null);
    assert.match(
      fs.readFileSync(path.join(saved.mirrorPath, 'Life Garden.md'), 'utf8'),
      /started_on: "2026-11-01"/,
    );
    store.close();
    store = createStore(dir);
    assert.equal(store.read().revision, saved.revision);
    assert.deepEqual(store.read().data.days, migrated.data.days);
    assert.equal(
      definition(
        store.read().data.habits.find((h) => h.id === 'journal')!,
        '2026-11-04',
      )?.name,
      'Morning journal',
    );
  } finally {
    store?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('new gardens begin on 1 November and existing earlier starts stay unchanged', () => {
  for (const start of [undefined, '2026-10-01']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-tracking-test-'));
    if (start) {
      const db = new Database(path.join(dir, 'life-garden.sqlite'));
      db.exec(
        'CREATE TABLE app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL)',
      );
      db.prepare('INSERT INTO app_state VALUES (1,2,?)').run(JSON.stringify(initialData(start)));
      db.close();
    }
    const store = createStore(dir);
    try {
      const current = store.read();
      assert.equal(current.data.startedOn, start || '2026-11-01');
      assert.deepEqual(current.data.days, {});
      assert.ok(scheduled(current.data, '2026-11-01').length > 0);
      if (start) assert.equal(current.revision, 2);
    } finally {
      store.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});
