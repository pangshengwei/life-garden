'use client';
import { useState } from 'react';
import { Check, Moon, Pencil, Trash2 } from 'lucide-react';
import {
  categories,
  completed,
  emptyDay,
  setHabitArchived,
  type HabitDefinition,
} from '@/lib/model';
import { CategoryIcon, Field, FormActions, Modal, useApp } from './ui';
import { HabitEditor } from './habit-management';
export function HabitRow({
  habit,
  date,
  showManagement = true,
}: {
  habit: HabitDefinition;
  date: string;
  showManagement?: boolean;
}) {
  const { data, update, notify, today } = useApp();
  const [editing, setEditing] = useState(false);
  const source = data.habits.find((h) => h.id === habit.id);
  const managed = showManagement && !!source && !source.archived;
  const val = data.days[date]?.logs[habit.id];
  const done = completed(habit, val);
  const [entry, setEntry] = useState(false);
  function log(value: number | 'rest') {
    update((d) => {
      d.days[date] ??= emptyDay();
      d.days[date].logs[habit.id] = value;
    });
    if (typeof value === 'number' && value >= habit.target && !done)
      notify('A small action. A little growth. +10 XP');
  }
  return (
    <>
      <div
        className={`habit-row ${done ? 'done' : ''} ${val === 'rest' ? 'resting' : ''} ${managed ? 'managed' : ''}`}
      >
        <button
          className={`habit-check ${done ? 'checked' : ''}`}
          aria-label={`${done ? 'Undo' : 'Complete'} ${habit.name}`}
          aria-pressed={done}
          onClick={() => log(done ? 0 : habit.target)}
        >
          {done ? <Check size={16} /> : val === 'rest' ? <Moon size={14} /> : null}
        </button>
        <CategoryIcon category={habit.category} size={17} />
        <div className="habit-info">
          <strong>{habit.name}</strong>
          <small>
            {val === 'rest'
              ? 'Recovery day · excluded from score'
              : habit.type === 'check'
                ? categories.find((c) => c.id === habit.category)?.short
                : `${typeof val === 'number' ? val : 0} / ${habit.target} ${habit.unit}`}
          </small>
        </div>
        <div className="habit-trailing">
          {habit.type !== 'check' && (
            <button className="text-button habit-log" onClick={() => setEntry(true)}>
              Log
            </button>
          )}
          <button
            className="rest-button"
            aria-label={`${val === 'rest' ? 'Resume' : 'Excuse'} ${habit.name} for this day`}
            title="Rest or adjust for today; excluded from score"
            onClick={() => log(val === 'rest' ? 0 : 'rest')}
          >
            <Moon size={15} />
          </button>
          <span className="xp-label">{done ? '✓' : '+10 XP'}</span>
          {managed && (
            <div className="habit-row-actions">
              <button
                className="icon-button"
                aria-label={'Edit or rename ' + habit.name}
                title="Rename or edit habit"
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button remove-habit-button"
                aria-label={'Remove ' + habit.name}
                title="Remove habit from today onward"
                onClick={() => {
                  update((d) =>
                    setHabitArchived(
                      d.habits.find((h) => h.id === habit.id)!,
                      true,
                      today,
                    ),
                  );
                  notify('Habit removed. You can restore it from Removed habits.');
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      {editing && source && <HabitEditor habit={source} onClose={() => setEditing(false)} />}
      {entry && (
        <Modal title={'Log ' + habit.name} onClose={() => setEntry(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              log(Number(form.get('value')));
              setEntry(false);
            }}
          >
            <Field label={`Amount (${habit.unit || 'value'})`}>
              <input
                name="value"
                type="number"
                min="0"
                max="100000"
                step="any"
                required
                defaultValue={typeof val === 'number' ? val : 0}
                autoFocus
              />
            </Field>
            <FormActions onClose={() => setEntry(false)} label="Save progress" />
          </form>
        </Modal>
      )}
    </>
  );
}
