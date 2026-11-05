'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Flag, Moon, Sprout } from 'lucide-react';
import { activityDay, dayGoalEvents, rollingHabitScore } from '@/lib/activity';
import { addDays, completed, dateLabel, definition, scheduled, weekday } from '@/lib/model';
import { Empty, Modal, Progress, useApp } from './ui';

export function HabitDayScore({ compact = false }: { compact?: boolean }) {
  const { data, today, setView } = useApp();
  const score = rollingHabitScore(data, today);
  return (
    <section
      className={`card rolling-score ${compact ? 'compact' : ''}`}
      aria-label="Past 30-day average daily habit score"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">PAST 30D HABIT SCORE</span>
          <h2>Average daily completion</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="rolling-value">
        <strong aria-live="polite" aria-atomic="true">
          {score.percent === null ? '—' : `${score.percent}%`}
        </strong>
        <span>
          {score.eligible} {score.eligible === 1 ? 'day' : 'days'} in this average
          <br />
          each day counts equally
        </span>
      </div>
      <Progress value={score.percent ?? 0} label="Average daily scheduled-habit completion" />
      <p className="muted">
        {score.tracked
          ? `${dateLabel(score.scoringStart)} – ${dateLabel(today)} · ${score.tracked}/30 calendar days in the scoring period`
          : 'Scoring begins 2 November 2026 or when your tracking begins, whichever is later'}
        {score.restDays ? ` · ${score.restDays} fully excused / unscheduled days excluded` : ''}.
      </p>
      <details>
        <summary>How this score works</summary>
        <p>
          Each day’s score is completed habits ÷ scheduled, non-excused habits × 100. A habit counts
          as completed when it meets its full target. This score averages those daily scores equally
          over today and the previous 29 days, counting only 2 November 2026 onward and no earlier
          than tracking began. Missing logs on an eligible day count as unfinished; fully paused,
          excused or unscheduled days are excluded. For example, 50% and 100% average to 75%, even
          if those days have different habit counts. Today’s check-offs and past-day corrections
          update the average immediately. Goal milestones do not affect it.
        </p>
      </details>
      {compact && (
        <button className="text-button" onClick={() => setView('Insights')}>
          Explore my daily board
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}

function DayDetails({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, today, setView } = useApp();
  const activity = activityDay(data, date, today),
    day = data.days[date];
  const habits = scheduled(data, date),
    events = dayGoalEvents(data, date);
  const sessions = data.sessions.filter((s) => s.date === date);
  return (
    <Modal
      title={dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      onClose={onClose}
      wide
    >
      <div className="day-summary">
        <span className={`tag ${activity.hit ? 'sage' : ''}`}>
          {activity.hit
            ? 'Daily habit goals hit'
            : !activity.tracked
              ? 'Before tracking began'
              : activity.total === 0
                ? 'Rest / no habits scheduled'
                : date === today
                  ? 'Today · room to grow'
                  : 'A day in your garden'}
        </span>
        <span>
          {activity.done} habits completed · {activity.achieved} goals achieved
        </span>
      </div>
      {!activity.tracked ? (
        <Empty title="This day is untracked">
          Your garden began on{' '}
          {dateLabel(data.startedOn, { day: 'numeric', month: 'long', year: 'numeric' })}. Earlier
          days are not treated as missed days.
        </Empty>
      ) : (
        <>
          {day?.priority && (
            <div className="day-priority">
              <span className="eyebrow">THE DAY’S INTENTION</span>
              <h3>{day.priority}</h3>
              {day.step && <p>{day.step}</p>}
            </div>
          )}
          <h3 className="day-detail-heading">Scheduled habits</h3>
          {habits.length ? (
            <ul className="day-habit-details">
              {habits.map((h) => {
                const value = day?.logs[h.id];
                const done = completed(h, value);
                return (
                  <li key={h.id}>
                    <span className={`detail-state ${done ? 'done' : ''}`}>
                      {done ? (
                        <Check size={15} />
                      ) : value === 'rest' ? (
                        <Moon size={15} />
                      ) : (
                        <span>·</span>
                      )}
                    </span>
                    <span>
                      {h.name}
                      <small>
                        {value === 'rest'
                          ? 'Excused / recovery'
                          : h.type === 'check'
                            ? done
                              ? 'Completed'
                              : 'No completion recorded'
                            : `${typeof value === 'number' ? value : 0} / ${h.target} ${h.unit}`}
                      </small>
                    </span>
                    <strong>{done ? 'Done' : value === 'rest' ? 'Rest' : 'Open'}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No habits were scheduled for this day.</p>
          )}
          {day && Object.keys(day.logs).some((id) => !habits.some((h) => h.id === id)) && (
            <p className="muted small-text">
              Saved logs for unscheduled or paused habits are retained, but do not count toward the
              scheduled-habit score.
            </p>
          )}
          <h3 className="day-detail-heading">Goal milestones & progress</h3>
          {events.length ? (
            <ul className="day-outcomes">
              {events.map((event) => (
                <li key={event.id}>
                  <Flag size={16} />
                  <div>
                    <strong>{event.title}</strong>
                    <p>
                      {event.previous.toLocaleString()} → {event.current.toLocaleString()} /{' '}
                      {event.target.toLocaleString()} {event.unit}
                      {event.achieved ? ' · Achieved' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No dated goal updates recorded. Existing goals aren’t assigned an invented achievement
              date.
            </p>
          )}
          {sessions.length > 0 && (
            <>
              <h3 className="day-detail-heading">Focus outcomes</h3>
              <ul className="day-outcomes">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Sprout size={16} />
                    <div>
                      <strong>{s.output}</strong>
                      <p>
                        {Math.round(s.seconds / 60)} minutes · {s.category}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(day?.wins || day?.notes || day?.lesson) && (
            <div className="day-journal">
              {day.wins && (
                <>
                  <h3>What went well</h3>
                  <p>{day.wins}</p>
                </>
              )}
              {day.notes && (
                <>
                  <h3>Notes</h3>
                  <p>{day.notes}</p>
                </>
              )}
              {day.lesson && (
                <>
                  <h3>A lesson to carry forward</h3>
                  <p>{day.lesson}</p>
                </>
              )}
            </div>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={onClose}>
              Close
            </button>
            <button
              className="button primary"
              onClick={() => {
                sessionStorage.setItem('journal-date', date);
                setView('Journal');
                onClose();
              }}
            >
              Open this day’s journal
              <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function ActivityBoard() {
  const { data, today } = useApp();
  const [selected, setSelected] = useState('');
  const [focusDate, setFocusDate] = useState(today);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cutoff = addDays(today, -364);
  const first = addDays(cutoff, -weekday(cutoff));
  const cells: string[] = [];
  for (let d = first; d <= addDays(today, 6 - weekday(today)); d = addDays(d, 1)) cells.push(d);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const total = cells
    .filter((d) => d >= cutoff && d <= today)
    .reduce((n, d) => n + activityDay(data, d, today).count, 0);
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, []);
  return (
    <section className="card activity-board" aria-label="Daily growth activity board">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A YEAR OF LITTLE STEPS</span>
          <h2>Your daily growth board</h2>
          <p className="muted">{total} completed habits & goal achievements in the last 365 days</p>
        </div>
        <span className="tag sage">
          <Sprout size={14} />
          Every little square counts
        </span>
      </div>
      <div className="activity-scroll" ref={scrollRef}>
        <div className="activity-calendar">
          <div className="activity-day-labels">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div
            className="activity-weeks"
            role="group"
            aria-label="Select a day to see what was done; use arrow keys to move between days"
          >
            {weeks.map((week, i) => (
              <div className="activity-week" key={week[0]}>
                <div className="activity-month">
                  {i === 0 || week[0].slice(0, 7) !== weeks[i - 1][0].slice(0, 7)
                    ? dateLabel(week[0], { month: 'short' })
                    : ''}
                </div>
                {week.map((date) => {
                  if (date < cutoff || date > today)
                    return <span className="activity-cell padding" key={date} />;
                  const a = activityDay(data, date, today);
                  const label = `${dateLabel(date, { day: 'numeric', month: 'long', year: 'numeric' })}: ${a.tracked ? `${a.done} habits completed, ${a.achieved} goals achieved${a.hit ? ', daily habit goals hit' : ''}` : 'not tracked'}`;
                  return (
                    <button
                      key={date}
                      data-activity-date={date}
                      tabIndex={focusDate === date ? 0 : -1}
                      aria-label={label}
                      title={label}
                      className={`activity-cell intensity-${a.intensity} ${!a.tracked ? 'untracked' : ''} ${a.hit ? 'day-hit' : ''} ${date === today ? 'is-today' : ''}`}
                      onFocus={() => setFocusDate(date)}
                      onClick={() => setSelected(date)}
                      onKeyDown={(event) => {
                        const shift: Record<string, number> = {
                          ArrowLeft: -7,
                          ArrowRight: 7,
                          ArrowUp: -1,
                          ArrowDown: 1,
                        };
                        if (!(event.key in shift)) return;
                        event.preventDefault();
                        const next = addDays(date, shift[event.key]);
                        scrollRef.current
                          ?.querySelector<HTMLButtonElement>(`[data-activity-date="${next}"]`)
                          ?.focus();
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="activity-footer">
        <p>
          Click a square to see what you did. Darker green = more completed habits and goal
          achievements.
        </p>
        <div className="activity-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <i
              key={i}
              className={`activity-cell intensity-${i}`}
              title={['0', '1', '2–3', '4–6', '7+'][i] + ' completions'}
            />
          ))}
          <span>More</span>
          <i className="activity-cell untracked" />
          <span>Untracked</span>
        </div>
      </div>
      {selected && <DayDetails date={selected} onClose={() => setSelected('')} />}
    </section>
  );
}
