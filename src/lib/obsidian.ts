import fs from 'node:fs';
import path from 'node:path';
import {
  categories,
  completed,
  dateKey,
  dayScore,
  definition,
  scheduled,
  type GardenData,
} from './model';
const end = '<!-- /life-garden:generated -->';
const q = (value: unknown) => JSON.stringify(value);
export function mirrorToObsidian(data: GardenData, root: string) {
  fs.mkdirSync(root, { recursive: true });
  function note(file: string, properties: Record<string, unknown>, body: string) {
    const dest = path.join(root, file + '.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let personal =
      '\n\n## Personal notes\n\nWrite here freely. This section is preserved when Life Garden updates.\n';
    if (fs.existsSync(dest)) {
      const existing = fs.readFileSync(dest, 'utf8');
      if (!existing.includes(end))
        throw new Error(`Existing note is not managed by Life Garden: ${file}`);
      personal = existing.slice(existing.indexOf(end) + end.length);
    }
    const contents =
      '---\n' +
      Object.entries({ ...properties, tags: ['life-garden'], managed_by: 'Life Garden' })
        .map(([k, v]) => `${k}: ${q(v)}`)
        .join('\n') +
      '\n---\n<!-- life-garden:generated; edit in app -->\n' +
      body +
      '\n' +
      end +
      personal;
    if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== contents) {
      fs.writeFileSync(dest + '.tmp', contents, { mode: 0o600 });
      fs.renameSync(dest + '.tmp', dest);
    }
  }
  const areaLink = (id: string) => `[[LG-area-${id}|${categories.find((c) => c.id === id)?.name}]]`;
  note(
    'Life Garden',
    { type: 'life-garden-index', started_on: data.startedOn },
    '# Life Garden 🌱\n\nCompound what matters. Simplify everything else.\n\n' +
      categories.map((c) => '- ' + areaLink(c.id)).join('\n') +
      '\n\n## Your records\n\n' +
      Object.keys(data.days)
        .sort()
        .reverse()
        .slice(0, 30)
        .map((d) => `- [[Life Garden/Daily/${d}|${d}]]`)
        .join('\n') +
      '\n\n## How this mirror works\n\nSQLite is the source of truth. Edit generated properties and records in the app. Your Personal notes section below each generated block is preserved. This is a one-way mirror, not two-way sync.\n\nOpen Daily.base and Goals.base in Obsidian Bases to visualise and filter your records. No plugin is required.\n\nRecords removed during a restore may remain in this vault for safety; the app only updates current records and never deletes vault notes.',
  );
  for (const c of categories)
    note(
      `Areas/LG-area-${c.id}`,
      { type: 'life-area', category: c.id },
      `# ${c.name}\n\n${c.description}\n\n## Goals\n${data.goals
        .filter((g) => g.category === c.id)
        .map((g) => `- [[LG-goal-${g.id}|${g.title}]]`)
        .join('\n')}\n\n## Habits\n${data.habits
        .filter((h) => !h.archived)
        .map((h) => definition(h, dateKey()) || { ...h.revisions[0], id: h.id })
        .filter((h) => h?.category === c.id)
        .map((h) => `- ${h!.name}`)
        .join('\n')}`,
    );
  for (const habit of data.habits) {
    const h = definition(habit, dateKey()) || { ...habit.revisions[0], id: habit.id };
    note(
      `Habits/LG-habit-${habit.id}`,
      {
        type: 'habit',
        habit_id: h.id,
        category: h.category,
        tracking: h.type,
        target: h.target,
        unit: h.unit,
        paused: h.paused,
        archived: !!habit.archived,
        scheduled_days: h.days,
      },
      `# ${h.name}\n\n${areaLink(h.category)}\n\nTarget: ${h.target} ${h.unit}\n\nSchedules and targets are edited in the app; previous revisions are retained in SQLite and JSON backups.`,
    );
  }
  for (const event of data.goalEvents || [])
    note(
      `Goal progress/LG-goal-event-${event.id}`,
      {
        type: 'goal-progress',
        date: event.date,
        goal_id: event.goalId,
        category: event.category,
        previous: event.previous,
        current: event.current,
        target: event.target,
        unit: event.unit,
        achieved: event.achieved,
        was_achieved: !!event.wasAchieved,
      },
      `# ${event.title} · ${event.date}\n\n[[LG-goal-${event.goalId}|${event.title}]] · ${areaLink(event.category)}\n\n${event.previous} → ${event.current} / ${event.target} ${event.unit}`,
    );
  for (const session of data.sessions)
    note(
      `Focus/LG-focus-${session.id}`,
      {
        type: 'focus-session',
        date: session.date,
        seconds: session.seconds,
        minutes: Math.round(session.seconds / 60),
        category: session.category,
      },
      `# A moment of focus · ${session.date}\n\n${areaLink(session.category)}\n\n${session.output}`,
    );
  for (const [date, day] of Object.entries(data.days)) {
    const score = dayScore(data, date);
    for (const [id, value] of Object.entries(day.logs)) {
      const habit = data.habits.find((h) => h.id === id);
      const h = habit ? definition(habit, date) : undefined;
      if (h)
        note(
          `Habit logs/LG-log-${date}-${id}`,
          {
            type: 'habit-log',
            date,
            habit_id: id,
            category: h.category,
            value: value === 'rest' ? null : value,
            target: h.target,
            unit: h.unit,
            completed: completed(h, value),
            excused: value === 'rest',
          },
          `# ${h.name} · ${date}\n\n[[LG-habit-${id}|${h.name}]] · ${areaLink(h.category)}\n\n${value === 'rest' ? 'Rest / excused' : `${value} / ${h.target} ${h.unit}`}`,
        );
    }

    note(
      `Daily/${date}`,
      {
        type: 'daily',
        date,
        mood: day.mood ?? null,
        energy: day.energy ?? null,
        completed: score.done,
        scheduled: score.total,
        consistency: score.percent,
        sleep_start: day.sleepStart ?? null,
        sleep_end: day.sleepEnd ?? null,
      },
      `# ${date}\n\n## One important thing\n${day.priority || 'Not set yet.'}\n\nFirst step: ${day.step || 'Not set yet.'}\n\n## Habits\n${scheduled(
        data,
        date,
      )
        .map(
          (h) =>
            `- [${completed(h, day.logs[h.id]) ? 'x' : ' '}] ${h.name} · ${day.logs[h.id] === 'rest' ? 'Recovery / excused' : (day.logs[h.id] ?? 0)} ${h.unit} · ${areaLink(h.category)}`,
        )
        .join(
          '\n',
        )}\n\n## Morning notes\n${day.notes}\n\n## What went well\n${day.wins}\n\n## Meaningful progress\n${day.progress}\n\n## Obstacles\n${day.obstacles}\n\n## What I learned\n${day.lesson}\n\n## Weekly reflection\n${day.weekly}\n\n## Focus sessions\n${data.sessions
        .filter((s) => s.date === date)
        .map(
          (s) => `- ${Math.round(s.seconds / 60)} minutes · ${s.output} · ${areaLink(s.category)}`,
        )
        .join('\n')}`,
    );
  }
  for (const g of data.goals)
    note(
      `Goals/LG-goal-${g.id}`,
      {
        type: 'goal',
        category: g.category,
        status: g.status,
        horizon: g.horizon,
        current: g.current,
        target: g.target,
        unit: g.unit,
        due: g.due || null,
        archived: g.archived,
      },
      `# ${g.title}\n\n${areaLink(g.category)}\n\n${g.current} / ${g.target} ${g.unit}\n\n${g.notes}\n\n${g.parentId ? `Depends on [[LG-goal-${g.parentId}]].` : ''}`,
    );
  for (const f of data.finance)
    note(
      `Finance/LG-finance-${f.date}`,
      {
        type: 'finance',
        date: f.date,
        currency: 'SGD',
        liquid_including_srs: f.liquid,
        accessible_excluding_srs: f.accessible,
        restricted_srs: f.liquid - f.accessible,
        net_worth: f.netWorth,
        securities: f.securities,
        investment_property_equity: f.property,
        etf_percent: f.etf,
        annual_contributions: f.contributions,
      },
      `# Financial snapshot · ${f.date}\n\n${areaLink('wealth')}\n\nHistorical manual snapshot; not live market data.\n\n${f.notes}`,
    );
  const bases: Record<string, string> = {
    'Habit history.base':
      'filters:\n  and:\n    - \'type == "habit-log"\'\n    - \'managed_by == "Life Garden"\'\nviews:\n  - type: table\n    name: Habit history\n    order:\n      - file.name\n      - date\n      - category\n      - value\n      - target\n      - completed\n      - excused\n',
    'Daily.base':
      'filters:\n  and:\n    - \'type == "daily"\'\n    - \'managed_by == "Life Garden"\'\nviews:\n  - type: table\n    name: Daily reflections\n    order:\n      - file.name\n      - date\n      - mood\n      - energy\n      - consistency\n',
    'Goals.base':
      'filters:\n  and:\n    - \'type == "goal"\'\n    - \'managed_by == "Life Garden"\'\nviews:\n  - type: table\n    name: Life goals\n    order:\n      - file.name\n      - category\n      - status\n      - current\n      - target\n      - due\n',
  };
  for (const [name, content] of Object.entries(bases))
    if (!fs.existsSync(path.join(root, name))) fs.writeFileSync(path.join(root, name), content);
}
