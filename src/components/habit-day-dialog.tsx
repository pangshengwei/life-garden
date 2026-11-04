'use client';
import { CalendarDays, Plus } from 'lucide-react';
import { dateLabel, definition, habitAvailability, includeHabitOnDate } from '@/lib/model';
import { HabitRow } from './habit-row';
import { Modal, useApp } from './ui';

/** A weekly square always opens the habit, not just the containing calendar date. */
export function HabitDayDialog({
  habitId,
  date,
  onClose,
}: {
  habitId: string;
  date: string;
  onClose: () => void;
}) {
  const { data, today, update, notify } = useApp();
  const habit = data.habits.find((h) => h.id === habitId);
  if (!habit) return null;
  const historical = definition(habit, date);
  const current = definition(habit, today) || { ...habit.revisions.at(-1)!, id: habit.id };
  const available = habitAvailability(habit, date);
  const displayed = historical || current;
  const dayLabel = dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });
  const reason =
    available === 'not-started'
      ? `This habit starts on ${dateLabel(habit.revisions[0].from, { day: 'numeric', month: 'long' })}.`
      : available === 'paused'
        ? 'This habit is paused on this date.'
        : `Its schedule on this date is ${historical!.days.map((d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}.`;
  return (
    <Modal title={`${displayed.name} · ${dateLabel(date)}`} onClose={onClose} wide>
      <p className="habit-cell-date">
        <CalendarDays size={16} />
        {dayLabel}
      </p>
      {available === 'scheduled' ? (
        <>
          <p className="muted">Record or correct this habit for this date.</p>
          <HabitRow habit={displayed} date={date} />
        </>
      ) : (
        <div className="habit-cell-unscheduled">
          <span className="tag">Not scheduled on this date</span>
          <h3>{current.name}</h3>
          <p>{reason}</p>
          {historical && historical.name !== current.name && (
            <p>Its name on this date was “{historical.name}”.</p>
          )}
          <p>Add it to this date to record what you did. This changes only this day’s plan.</p>
          <button
            className="button primary"
            onClick={() => {
              update((d) =>
                includeHabitOnDate(
                  d.habits.find((h) => h.id === habitId)!,
                  date,
                  today,
                ),
              );
              notify(`Habit added to ${dateLabel(date)}. You can log it now.`);
            }}
          >
            <Plus size={15} />
            Add to this day
          </button>
        </div>
      )}
    </Modal>
  );
}
