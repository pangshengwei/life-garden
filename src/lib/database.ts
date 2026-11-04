import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { dateKey, definition, initialData, type GardenData } from './model';
import { mirrorToObsidian } from './obsidian';
export class ConflictError extends Error {}
export function createStore(directory: string, vaultRoot?: string) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const dbPath = path.join(directory, 'life-garden.sqlite');
  const db = new Database(dbPath);
  fs.chmodSync(dbPath, 0o600);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_notes (date TEXT PRIMARY KEY, priority TEXT, first_step TEXT, mood INTEGER, energy INTEGER, sleep_start TEXT, sleep_end TEXT, notes TEXT, wins TEXT, progress TEXT, obstacles TEXT, lesson TEXT, weekly_reflection TEXT);
    CREATE TABLE IF NOT EXISTS habits (id TEXT PRIMARY KEY, name TEXT, category TEXT, type TEXT, target REAL, paused INTEGER, revisions_json TEXT, archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS habit_logs (date TEXT, habit_id TEXT, value REAL, excused INTEGER, PRIMARY KEY(date,habit_id));
    CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, title TEXT, category TEXT, status TEXT, current REAL, target REAL, unit TEXT, due TEXT, horizon TEXT, parent_id TEXT, archived INTEGER, notes TEXT);
    CREATE TABLE IF NOT EXISTS financial_snapshots (id TEXT PRIMARY KEY, date TEXT UNIQUE, liquid_including_srs REAL, accessible_excluding_srs REAL, net_worth REAL, securities REAL, investment_property_equity REAL, etf_percent REAL, annual_contributions REAL, notes TEXT);
    CREATE TABLE IF NOT EXISTS goal_events (id TEXT PRIMARY KEY, goal_id TEXT, date TEXT, title TEXT, category TEXT, previous REAL, current REAL, target REAL, unit TEXT, achieved INTEGER, was_achieved INTEGER);
    CREATE TABLE IF NOT EXISTS focus_sessions (id TEXT PRIMARY KEY, date TEXT, seconds REAL, output TEXT, category TEXT);`);
  // Existing databases predate reversible habit removal.
  const habitColumns = db.pragma('table_info(habits)') as Array<{ name: string }>;
  if (!habitColumns.some((column) => column.name === 'archived'))
    db.exec('ALTER TABLE habits ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  const mirrorPath = path.join(vaultRoot || path.join(directory, 'obsidian'), 'Life Garden');
  function relational(data: GardenData) {
    for (const table of [
      'daily_notes',
      'habits',
      'habit_logs',
      'goals',
      'financial_snapshots',
      'focus_sessions',
      'goal_events',
    ])
      db.prepare(`DELETE FROM ${table}`).run();
    const dayInsert = db.prepare('INSERT INTO daily_notes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const logInsert = db.prepare('INSERT INTO habit_logs VALUES (?,?,?,?)');
    for (const [date, d] of Object.entries(data.days)) {
      dayInsert.run(
        date,
        d.priority,
        d.step,
        d.mood ?? null,
        d.energy ?? null,
        d.sleepStart ?? null,
        d.sleepEnd ?? null,
        d.notes,
        d.wins,
        d.progress,
        d.obstacles,
        d.lesson,
        d.weekly,
      );
      for (const [id, value] of Object.entries(d.logs))
        logInsert.run(date, id, value === 'rest' ? null : value, value === 'rest' ? 1 : 0);
    }
    const habitInsert = db.prepare(
      'INSERT INTO habits (id,name,category,type,target,paused,revisions_json,archived) VALUES (?,?,?,?,?,?,?,?)',
    );
    for (const h of data.habits) {
      const r = definition(h, dateKey()) || h.revisions[0];
      habitInsert.run(
        h.id,
        r.name,
        r.category,
        r.type,
        r.target,
        r.paused ? 1 : 0,
        JSON.stringify(h.revisions),
        h.archived ? 1 : 0,
      );
    }
    const goalInsert = db.prepare('INSERT INTO goals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const g of data.goals)
      goalInsert.run(
        g.id,
        g.title,
        g.category,
        g.status,
        g.current,
        g.target,
        g.unit,
        g.due,
        g.horizon,
        g.parentId,
        g.archived ? 1 : 0,
        g.notes,
      );
    const financeInsert = db.prepare(
      'INSERT INTO financial_snapshots VALUES (?,?,?,?,?,?,?,?,?,?)',
    );
    for (const f of data.finance)
      financeInsert.run(
        f.id,
        f.date,
        f.liquid,
        f.accessible,
        f.netWorth,
        f.securities,
        f.property,
        f.etf,
        f.contributions,
        f.notes,
      );
    const eventInsert = db.prepare('INSERT INTO goal_events VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    for (const e of data.goalEvents || [])
      eventInsert.run(
        e.id,
        e.goalId,
        e.date,
        e.title,
        e.category,
        e.previous,
        e.current,
        e.target,
        e.unit,
        e.achieved ? 1 : 0,
        e.wasAchieved ? 1 : 0,
      );
    const sessionInsert = db.prepare('INSERT INTO focus_sessions VALUES (?,?,?,?,?)');
    for (const s of data.sessions) sessionInsert.run(s.id, s.date, s.seconds, s.output, s.category);
  }
  if (!db.prepare('SELECT 1 FROM app_state').get()) {
    const data = initialData(dateKey());
    db.transaction(() => {
      db.prepare('INSERT INTO app_state VALUES (1,0,?)').run(JSON.stringify(data));
      relational(data);
    })();
  }
  function read() {
    const row = db.prepare('SELECT revision,json FROM app_state WHERE id=1').get() as {
      revision: number;
      json: string;
    };
    return { data: JSON.parse(row.json) as GardenData, revision: row.revision };
  }
  function mirror(data: GardenData) {
    try {
      mirrorToObsidian(data, mirrorPath);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Mirror could not be written';
    }
  }
  function save(data: GardenData, baseRevision: number) {
    const revision = db.transaction(() => {
      const row = read();
      if (row.revision !== baseRevision)
        throw new ConflictError(
          'Another tab changed your garden. Export your unsaved edits, then reload.',
        );
      const next = row.revision + 1;
      db.prepare('UPDATE app_state SET revision=?,json=? WHERE id=1').run(
        next,
        JSON.stringify(data),
      );
      relational(data);
      return next;
    })();
    // SQLite commits first: mirror failures never discard the durable app save.
    return { revision, mirrorError: mirror(data), mirrorPath, dbPath };
  }
  return { read, save, mirror, dbPath, mirrorPath, close: () => db.close() };
}
let store: ReturnType<typeof createStore> | undefined;
export function getStore() {
  return (store ??= createStore(
    path.resolve(
      /* turbopackIgnore: true */ process.env.LIFE_GARDEN_DATA_DIR ||
        path.join(process.cwd(), 'data'),
    ),
    process.env.OBSIDIAN_VAULT_PATH,
  ));
}
