'use client';
import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import {
  definition,
  reviseHabit,
  setHabitArchived,
  type Habit,
  type HabitDefinition,
} from '@/lib/model';
import { CategorySelect, Empty, Field, FormActions, Modal, useApp } from './ui';
export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { update, today, notify } = useApp();
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
          if (!draft.name.trim()) {
            setError('Give your habit a name.');
            return;
          }
          if (!draft.days.length) {
            setError('Choose at least one day. You can pause the habit if you need a break.');
            return;
          }
          update((d) => {
            const revision = { ...draft, name: draft.name.trim(), from: today };
            if (habit) {
              const h = d.habits.find((h) => h.id === habit.id)!;
              reviseHabit(h, revision, today);
            } else d.habits.push({ id: crypto.randomUUID(), revisions: [revision] });
          });
          notify(
            habit
              ? 'Habit updated. Earlier days keep their history.'
              : 'A new little habit, ready to grow.',
          );
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

export function NewHabitButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Plus size={15} />
        New habit
      </button>
      {open && <HabitEditor onClose={() => setOpen(false)} />}
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
