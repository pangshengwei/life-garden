'use client';
import { useState } from 'react';
import {
  Archive,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Pencil,
  Plus,
  Sprout,
} from 'lucide-react';
import {
  addDays,
  categories,
  completed,
  dateLabel,
  dayScore,
  definition,
  scheduled,
  totalXP,
  weekDates,
  type Category,
  type Goal,
  type Habit,
  type HabitDefinition,
} from '@/lib/model';
import {
  CategoryIcon,
  CategorySelect,
  Empty,
  Field,
  FormActions,
  Modal,
  Progress,
  useApp,
} from './ui';
import { HabitRow } from './today';
import { Plant } from './plant';
import { ActivityBoard, HabitDayScore } from './activity-board';
export function GoalEditor({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { data, update, notify, today } = useApp();
  const [draft, setDraft] = useState<Goal>(
    goal || {
      id: crypto.randomUUID(),
      title: '',
      category: 'career',
      horizon: 'Quarterly',
      status: 'In progress',
      current: 0,
      target: 1,
      unit: 'outcome',
      due: addDays(today, 90),
      parentId: '',
      archived: false,
      notes: '',
    },
  );
  const [error, setError] = useState('');
  function patch(part: Partial<Goal>) {
    setDraft({ ...draft, ...part });
  }
  return (
    <Modal title={goal ? 'Tend to this goal' : 'Plant a new goal'} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          let p = draft.parentId;
          const seen = new Set([draft.id]);
          while (p) {
            if (seen.has(p)) {
              setError('This dependency would create a cycle.');
              return;
            }
            seen.add(p);
            p = data.goals.find((g) => g.id === p)?.parentId || '';
          }
          update((d) => {
            const i = d.goals.findIndex((g) => g.id === draft.id);
            const before = i >= 0 ? d.goals[i] : undefined;
            if (
              (!before && (draft.current > 0 || draft.status === 'Achieved')) ||
              (before && (before.current !== draft.current || before.status !== draft.status))
            ) {
              d.goalEvents ??= [];
              d.goalEvents.push({
                id: crypto.randomUUID(),
                goalId: draft.id,
                date: today,
                title: draft.title,
                category: draft.category,
                previous: before?.current ?? 0,
                current: draft.current,
                target: draft.target,
                unit: draft.unit,
                achieved: draft.status === 'Achieved',
                wasAchieved: before?.status === 'Achieved',
              });
            }
            if (i >= 0) d.goals[i] = draft;
            else d.goals.push(draft);
          });
          notify('Your goal has room to grow.');
          onClose();
        }}
      >
        <Field label="A meaningful outcome">
          <input
            required
            autoFocus
            maxLength={500}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Life area">
            <CategorySelect value={draft.category} onChange={(category) => patch({ category })} />
          </Field>
          <Field label="Horizon">
            <select
              value={draft.horizon}
              onChange={(e) => patch({ horizon: e.target.value as Goal['horizon'] })}
            >
              {['Annual', 'Quarterly', 'Monthly', 'Weekly'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Current progress">
            <input
              type="number"
              required
              min="0"
              max="1000000000000"
              step="any"
              value={draft.current}
              onChange={(e) => patch({ current: Number(e.target.value) })}
            />
          </Field>
          <Field label="Target">
            <input
              type="number"
              required
              min="0.001"
              max="1000000000000"
              step="any"
              value={draft.target}
              onChange={(e) => patch({ target: Number(e.target.value) })}
            />
          </Field>
          <Field label="Unit">
            <input
              value={draft.unit}
              maxLength={100}
              onChange={(e) => patch({ unit: e.target.value })}
              placeholder="customers, SGD, outcomes…"
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as Goal['status'] })}
            >
              {['In progress', 'Achieved', 'Aspirational'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Target date (optional)">
            <input type="date" value={draft.due} onChange={(e) => patch({ due: e.target.value })} />
          </Field>
          <Field label="Depends on">
            <select value={draft.parentId} onChange={(e) => patch({ parentId: e.target.value })}>
              <option value="">No dependency</option>
              {data.goals
                .filter((g) => g.id !== draft.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="Milestone, evidence, or next action">
          <textarea
            rows={4}
            maxLength={20000}
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="What would progress look like? For a qualitative goal, use 0/1 and describe the evidence here."
          />
        </Field>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <FormActions onClose={onClose} />
      </form>
    </Modal>
  );
}
export function GoalsView() {
  const { data, update, category, setCategory, today, setView } = useApp();
  const [edit, setEdit] = useState<Goal | null | undefined>(undefined);
  const [archived, setArchived] = useState(false);
  const [horizon, setHorizon] = useState('All horizons');
  const goals = data.goals.filter(
    (g) =>
      g.archived === archived &&
      (!category || g.category === category) &&
      (horizon === 'All horizons' || g.horizon === horizon),
  );
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">DIRECTION, WITHOUT THE PRESSURE</span>
          <h1>Goals & little milestones</h1>
          <p className="subtitle">Meaningful outcomes. Small steps to get there.</p>
        </div>
        <button className="button primary" onClick={() => setEdit(null)}>
          <Plus size={17} />
          Plant a goal
        </button>
      </div>
      <CategoryFilter />
      {category && (
        <section className="card related-habits">
          <div className="section-heading">
            <h3>Supporting habits in this corner</h3>
            <button className="text-button" onClick={() => setView('Habits')}>
              Edit habits
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="related-habit-tags">
            {data.habits
              .map((h) => definition(h, today))
              .filter((h) => h?.category === category)
              .map((h) => (
                <span className="tag" key={h!.id}>
                  {h!.name}
                  {h!.paused ? ' · paused' : ''}
                </span>
              ))}
          </div>
        </section>
      )}
      <div className="view-toolbar">
        <select
          aria-label="Filter goal horizon"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
        >
          {['All horizons', 'Annual', 'Quarterly', 'Monthly', 'Weekly'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="text-button" onClick={() => setArchived(!archived)}>
          <Archive size={15} />
          {archived ? 'Show active goals' : 'View archived'}
        </button>
      </div>
      <div className="goals-grid">
        {goals.map((g) => (
          <section className="card goal-card" key={g.id}>
            <div className="section-heading">
              <CategoryIcon category={g.category} />
              <span
                className={`tag ${g.status === 'Achieved' ? 'sage' : g.status === 'Aspirational' ? 'lavender' : ''}`}
              >
                {g.status}
              </span>
            </div>
            <small className="muted">
              {g.horizon}
              {g.due
                ? ' · ' + dateLabel(g.due, { month: 'short', day: 'numeric', year: 'numeric' })
                : ' · Your own timeline'}
            </small>
            <h2>{g.title}</h2>
            <p className="goal-notes">{g.notes || 'Define a small next step when you’re ready.'}</p>
            <div className="goal-metric">
              <strong>
                {g.current.toLocaleString()}{' '}
                <span>
                  / {g.target.toLocaleString()} {g.unit}
                </span>
              </strong>
              <span>{Math.min(100, Math.round((g.current / g.target) * 100))}%</span>
            </div>
            <Progress value={(g.current / g.target) * 100} />
            {g.parentId && (
              <p className="dependency">
                Depends on: {data.goals.find((p) => p.id === g.parentId)?.title}
              </p>
            )}
            <div className="goal-actions">
              <button className="text-button" onClick={() => setEdit(g)}>
                <Pencil size={14} />
                Update progress
              </button>
              <button
                className="icon-button"
                aria-label={`${g.archived ? 'Restore' : 'Archive'} ${g.title}`}
                onClick={() =>
                  update((d) => {
                    d.goals.find((x) => x.id === g.id)!.archived = !g.archived;
                  })
                }
              >
                <Archive size={16} />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!goals.length && (
        <Empty title="A little space for something meaningful">
          Plant a goal or choose a different life area.
        </Empty>
      )}
      {edit !== undefined && (
        <GoalEditor goal={edit || undefined} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
export function CategoryFilter() {
  const { category, setCategory } = useApp();
  return (
    <div className="category-filters" role="group" aria-label="Filter by life area">
      <button className={!category ? 'selected' : ''} onClick={() => setCategory(null)}>
        All areas
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          className={category === c.id ? 'selected' : ''}
          onClick={() => setCategory(c.id)}
        >
          {c.short}
        </button>
      ))}
    </div>
  );
}
export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { update, today } = useApp();
  const current = habit ? definition(habit, today) : null;
  const [draft, setDraft] = useState<Omit<HabitDefinition, 'id'>>(
    current || {
      from: today,
      name: '',
      category: 'health',
      days: [0, 1, 2, 3, 4, 5, 6],
      paused: false,
      type: 'check',
      target: 1,
      unit: '',
    },
  );
  const [error, setError] = useState('');
  const patch = (v: Partial<typeof draft>) => setDraft({ ...draft, ...v });
  return (
    <Modal title={habit ? 'Make this habit yours' : 'A new little habit'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.days.length) {
            setError('Choose at least one day. You can pause the habit if you need a break.');
            return;
          }
          update((d) => {
            const revision = { ...draft, from: today };
            if (habit) {
              const h = d.habits.find((h) => h.id === habit.id)!;
              h.revisions = [...h.revisions.filter((r) => r.from < today), revision];
            } else d.habits.push({ id: crypto.randomUUID(), revisions: [revision] });
          });
          onClose();
        }}
      >
        <Field label="Habit name">
          <input
            required
            maxLength={300}
            autoFocus
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Life area">
          <CategorySelect value={draft.category} onChange={(category) => patch({ category })} />
        </Field>
        <Field label="Track as">
          <select
            value={draft.type}
            onChange={(e) =>
              patch({
                type: e.target.value as HabitDefinition['type'],
                target: e.target.value === 'check' ? 1 : draft.target,
                unit: e.target.value === 'minutes' ? 'min' : draft.unit,
              })
            }
          >
            <option value="check">Yes / no</option>
            <option value="count">Count</option>
            <option value="minutes">Minutes</option>
            <option value="number">Numeric measurement</option>
          </select>
        </Field>
        {draft.type !== 'check' && (
          <div className="form-grid">
            <Field label="Target (at least)">
              <input
                required
                type="number"
                min="0.01"
                step="any"
                max="1000000"
                value={draft.target}
                onChange={(e) => patch({ target: Number(e.target.value) })}
              />
            </Field>
            <Field label="Unit">
              <input
                maxLength={50}
                value={draft.unit}
                onChange={(e) => patch({ unit: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="field">
          <span>Scheduled days</span>
          <div className="day-picker">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((s, i) => (
              <button
                key={i}
                type="button"
                aria-label={
                  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]
                }
                aria-pressed={draft.days.includes(i)}
                className={draft.days.includes(i) ? 'selected' : ''}
                onClick={() =>
                  patch({
                    days: draft.days.includes(i)
                      ? draft.days.filter((d) => d !== i)
                      : [...draft.days, i],
                  })
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.paused}
            onChange={(e) => patch({ paused: e.target.checked })}
          />
          Pause this habit. It will be excluded from future scores.
        </label>
        <p className="muted small-text">
          Changes apply from today. Earlier schedules and targets are preserved. Weekly habits recur
          on the days you choose.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <FormActions onClose={onClose} />
      </form>
    </Modal>
  );
}
export function HabitsView() {
  const { data, today } = useApp();
  const [edit, setEdit] = useState<Habit | null | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const dates = weekDates(addDays(today, offset * 7));
  const visible = data.habits.map((h) => ({ habit: h, def: definition(h, today)! }));
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CONSISTENCY OVER PERFECT STREAKS</span>
          <h1>Your everyday roots</h1>
          <p className="subtitle">A rhythm that supports your life. Rest belongs here, too.</p>
        </div>
        <button className="button primary" onClick={() => setEdit(null)}>
          <Plus size={17} />
          New habit
        </button>
      </div>
      <HabitDayScore />
      <ActivityBoard />
      <div className="card heatmap-card">
        <div className="section-heading">
          <div>
            <h2>A week of little steps</h2>
            <p className="muted">
              {dateLabel(dates[0])} –{' '}
              {dateLabel(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="button-group">
            <button
              className="icon-button"
              aria-label="Previous week"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setOffset(0);
                setSelected(today);
              }}
            >
              This week
            </button>
            <button
              className="icon-button"
              aria-label="Next week"
              disabled={offset >= 0}
              onClick={() => setOffset(offset + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <p className="table-scroll-hint">Swipe the calendar to see the whole week.</p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable weekly habit history"
        >
          <table className="habit-table">
            <thead>
              <tr>
                <th>HABIT</th>
                {dates.map((d) => (
                  <th key={d}>
                    <button
                      className={selected === d ? 'selected day-heading' : 'day-heading'}
                      disabled={d > today || d < data.startedOn}
                      onClick={() => setSelected(d)}
                    >
                      {dateLabel(d, { weekday: 'short' })}
                      <strong>{d.slice(-2)}</strong>
                    </button>
                  </th>
                ))}
                <th>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ habit, def }) => (
                <tr key={habit.id}>
                  <td>
                    <div className="table-habit">
                      <CategoryIcon category={def.category} size={15} />
                      <span>
                        {def.name}
                        {def.paused && <small>Paused</small>}
                      </span>
                    </div>
                  </td>
                  {dates.map((date) => {
                    const h = scheduled(data, date).find((h) => h.id === habit.id);
                    const value = data.days[date]?.logs[habit.id];
                    const state =
                      date > today
                        ? 'future'
                        : !h
                          ? 'off'
                          : value === 'rest'
                            ? 'excused'
                            : completed(h, value)
                              ? 'complete'
                              : 'empty';
                    return (
                      <td key={date}>
                        <button
                          className={`heat-cell ${state}`}
                          aria-label={`${def.name}, ${date}: ${state}`}
                          disabled={date > today || date < data.startedOn}
                          onClick={() => setSelected(date)}
                        >
                          {state === 'complete' ? (
                            <Check size={15} />
                          ) : state === 'excused' ? (
                            '☾'
                          ) : state === 'off' ? (
                            '·'
                          ) : (
                            ''
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <button
                      className="icon-button"
                      aria-label={'Edit ' + def.name}
                      onClick={() => setEdit(habit)}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="heat-legend">
          <span>
            <i className="complete" />
            Completed
          </span>
          <span>
            <i className="empty" />
            No completion recorded
          </span>
          <span>☾ Rest / excused</span>
          <span>· Not scheduled</span>
        </div>
      </div>
      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOG OR CORRECT A DAY</span>
            <h2>{dateLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          </div>
          <span className="tag">
            {dayScore(data, selected).done} / {dayScore(data, selected).total} complete
          </span>
        </div>
        {scheduled(data, selected).map((h) => (
          <HabitRow key={h.id} habit={h} date={selected} />
        ))}
        {!scheduled(data, selected).length && (
          <p className="muted">No habits scheduled. A little breathing room.</p>
        )}
      </section>
      {edit !== undefined && (
        <HabitEditor habit={edit || undefined} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
export function GardenView() {
  const { data, today, setView, setCategory } = useApp();
  const xp = totalXP(data);
  const week = weekDates(today).filter((d) => d <= today && d >= data.startedOn);
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">A LIFE WITH ROOM TO BLOOM</span>
          <h1>Welcome to your garden</h1>
          <p className="subtitle">
            Six little corners of a life well lived. They grow at their own pace.
          </p>
        </div>
        <span className="tag sage">
          Level {Math.floor(xp / 100) + 1} · {xp} XP
        </span>
      </div>
      <section className="garden-banner">
        <Plant stage={Math.floor(xp / 80)} />
        <div>
          <span className="eyebrow">ROOTED IN WHAT MATTERS</span>
          <h2>
            You’re growing a life,
            <br />
            one small choice at a time.
          </h2>
          <p>
            Sleep, connection, curiosity, meaningful work.
            <br />
            There’s more than one way to make progress.
          </p>
          <small>
            Habit completion +10 XP · reflection +15 · weekly reflection +20 · first ≥1-minute focus
            session per day +20 · achieved goal +30. Levels never decrease for missed days.
          </small>
        </div>
      </section>
      <div className="area-grid">
        {categories.map((c) => {
          const goals = data.goals.filter(
            (g) => g.category === c.id && !g.archived && g.status !== 'Aspirational',
          );
          const done = week.reduce(
            (sum, date) =>
              sum +
              scheduled(data, date).filter(
                (h) => h.category === c.id && completed(h, data.days[date]?.logs[h.id]),
              ).length,
            0,
          );
          const progress = goals.length
            ? Math.round(
                (goals.reduce((sum, g) => sum + Math.min(1, g.current / g.target), 0) /
                  goals.length) *
                  100,
              )
            : 0;
          return (
            <button
              key={c.id}
              className={`card area-card ${c.color}`}
              onClick={() => {
                setCategory(c.id);
                setView('Goals');
              }}
            >
              <CategoryIcon category={c.id} size={24} />
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <div className="area-metrics">
                <div>
                  <strong>{done}</strong>
                  <span>actions this week</span>
                </div>
                <div>
                  <strong>{goals.length ? `${progress}%` : '—'}</strong>
                  <span>{goals.length ? 'active goal progress' : 'define an outcome'}</span>
                </div>
              </div>
              <Progress value={progress} />
              <div className="area-link">
                Tend to this corner
                <ArrowRight size={16} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
