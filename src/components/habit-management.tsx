'use client';
import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import {
  definition,
  dateLabel,
  addDays,
  type HabitEditScope,
  reviseHabit,
  setHabitArchived,
  type Habit,
  type HabitDefinition,
} from '@/lib/model';
import { CategorySelect, Empty, Field, FormActions, Modal, useApp } from './ui';
export function HabitEditor({
  habit,
  onClose,
  effectiveDate,
}: {
  habit?: Habit;
  onClose: () => void;
  effectiveDate?: string;
}) {
  const { data, update, today, notify } = useApp();
  const [date, setDate] = useState(effectiveDate || today);
  const [scope, setScope] = useState<HabitEditScope>(habit && date < today ? 'day' : 'onward');
  const current = habit
    ? definition(habit, date) || definition(habit, today) || habit.revisions[0]
    : null;
  const [draft, setDraft] = useState<Omit<HabitDefinition, 'id'>>(
    current || {
      from: date,
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
          if (!draft.name.trim()) {
            setError('Give your habit a name.');
            return;
          }
          if (!draft.days.length) {
            setError('Choose at least one day. You can pause the habit if you need a break.');
            return;
          }
          update((d) => {
            const revision = { ...draft, name: draft.name.trim(), from: date };
            if (habit) {
              const h = d.habits.find((h) => h.id === habit.id)!;
              reviseHabit(h, revision, date, scope);
            } else {
              const added: Habit = { id: crypto.randomUUID(), revisions: [revision] };
              if (scope === 'day')
                added.revisions.push({ ...revision, from: addDays(date, 1), paused: true });
              d.habits.push(added);
            }
          });
          notify(
            scope === 'day'
              ? `Habit saved for ${dateLabel(date)} only.`
              : `Habit saved from ${dateLabel(date)}. Later saved changes are kept.`,
          );
          onClose();
        }}
      >
        <div className="habit-edit-date-context">
          <strong>
            {habit ? 'Editing' : 'Creating for'}{' '}
            {dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </strong>
          <p>Choose when this change applies.</p>
        </div>
        <div className="form-grid">
          <Field label={scope === 'day' ? 'Apply on' : 'Start date'}>
            <input
              type="date"
              required
              min={data.startedOn}
              max={today}
              value={date}
              onInput={(e) => {
                if (e.currentTarget.value) setDate(e.currentTarget.value);
              }}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </Field>
          <Field label="Apply changes">
            <select value={scope} onChange={(e) => setScope(e.target.value as HabitEditScope)}>
              <option value="day">Only this day</option>
              <option value="onward">From this date onward</option>
            </select>
          </Field>
        </div>
        {habit && date < today && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const latest = definition(habit, today) || habit.revisions.at(-1)!;
              setDraft({ ...latest, from: date });
            }}
          >
            Use today’s name, target and schedule
          </button>
        )}
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
          {scope === 'day'
            ? 'Pause this habit on this date. Excluded from that day’s score.'
            : 'Pause this habit from this date. Excluded while paused.'}
        </label>
        <p className="muted small-text">
          {scope === 'day'
            ? 'This edits only the chosen date. Other dates keep their saved settings.'
            : 'This applies until the next saved change, if any. Earlier dates and later saved changes are preserved.'}{' '}
          Weekly habits recur on the days you choose.
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

export function NewHabitButton({ effectiveDate }: { effectiveDate?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Plus size={15} />
        New habit
      </button>
      {open && <HabitEditor effectiveDate={effectiveDate} onClose={() => setOpen(false)} />}
    </>
  );
}
export function RemovedHabitsButton() {
  const { data, update, today, notify } = useApp();
  const [open, setOpen] = useState(false);
  const removed = data.habits.filter((h) => h.archived);
  if (!removed.length && !open) return null;
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        Removed habits ({removed.length})
      </button>
      {open && (
        <Modal title="Removed habits" onClose={() => setOpen(false)}>
          <p className="muted">
            Removed habits stay out of your daily list. Earlier schedules and saved logs are kept.
            Restore a habit to resume it from today.
          </p>
          {removed.length ? (
            <ul className="removed-habit-list">
              {removed.map((h) => (
                <li key={h.id}>
                  <span>{definition(h, today)?.name || h.revisions.at(-1)!.name}</span>
                  <button
                    className="button secondary"
                    aria-label={'Restore ' + h.revisions.at(-1)!.name}
                    onClick={() => {
                      update((d) =>
                        setHabitArchived(
                          d.habits.find((x) => x.id === h.id)!,
                          false,
                          today,
                        ),
                      );
                      notify('Habit restored from today.');
                    }}
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Everything is back in your garden">You have no removed habits.</Empty>
          )}
        </Modal>
      )}
    </>
  );
}
