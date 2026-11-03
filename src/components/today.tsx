'use client';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coffee,
  Moon,
  Pencil,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sprout,
  Sun,
  Timer,
  X,
  Maximize2,
} from 'lucide-react';
import {
  addDays,
  categories,
  completed,
  dateLabel,
  dayScore,
  emptyDay,
  scheduled,
  totalXP,
  weekDates,
  type HabitDefinition,
} from '@/lib/model';
import { CategoryIcon, CategorySelect, Field, FormActions, Modal, Progress, useApp } from './ui';
import { Plant } from './plant';
import { HabitDayScore } from './activity-board';
export function PlanDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, updateDay, notify } = useApp();
  const day = data.days[date] || emptyDay();
  const [priority, setPriority] = useState(day.priority);
  const [step, setStep] = useState(day.step);
  return (
    <Modal
      title={
        dateLabel(date, { weekday: 'long', day: 'numeric', month: 'short' }) +
        ' · one important thing'
      }
      onClose={onClose}
    >
      <p className="muted">
        Give your next session a clear place to start. One small, tangible deliverable is enough.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateDay(date, { priority: priority.trim(), step: step.trim() });
          notify('A little clarity for your next day.');
          onClose();
        }}
      >
        <Field label="My one important thing">
          <input
            autoFocus
            required
            maxLength={500}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="e.g. Ship the first working habit tracker"
          />
        </Field>
        <Field label="The first concrete step">
          <textarea
            rows={3}
            maxLength={2000}
            value={step}
            onChange={(e) => setStep(e.target.value)}
            placeholder="e.g. Create a habit and save its first completion"
          />
        </Field>
        <FormActions onClose={onClose} label="Plant the intention" />
      </form>
    </Modal>
  );
}
export function HabitRow({ habit, date }: { habit: HabitDefinition; date: string }) {
  const { data, update, notify } = useApp();
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
      <div className={`habit-row ${done ? 'done' : ''} ${val === 'rest' ? 'resting' : ''}`}>
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
      </div>
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
export function FocusTimer({ now }: { now: Date }) {
  const { data, update, today, notify } = useApp();
  const timer = data.timer;
  const [minutes, setMinutes] = useState(60);
  const [full, setFull] = useState(false);
  const [finish, setFinish] = useState(false);
  const [output, setOutput] = useState('');
  const remain = timer
    ? timer.deadline
      ? Math.max(0, Math.ceil((timer.deadline - now.getTime()) / 1000))
      : timer.remaining
    : minutes * 60;
  const running = !!timer?.deadline && remain > 0;
  const elapsed = timer ? Math.max(0, timer.duration - remain) : 0;
  const ready = !!timer && remain === 0;
  function toggle() {
    update((d) => {
      if (!d.timer)
        d.timer = {
          duration: minutes * 60,
          remaining: minutes * 60,
          deadline: Date.now() + minutes * 60000,
          task: d.days[today]?.priority || 'One meaningful focus session',
          category: 'career',
        };
      else if (d.timer.deadline) d.timer = { ...d.timer, remaining: remain, deadline: null };
      else d.timer.deadline = Date.now() + remain * 1000;
    });
  }
  const content = (
    <>
      <div className="section-heading">
        <h3>
          <Timer size={17} />A little room to focus
        </h3>
        <button
          className="icon-button"
          aria-label={full ? 'Close focus mode' : 'Open focus mode'}
          onClick={() => setFull(!full)}
        >
          {full ? <X size={18} /> : <Maximize2 size={16} />}
        </button>
      </div>
      {full && (
        <>
          <span className="eyebrow">TODAY’S ONE IMPORTANT THING</span>
          <h2>{timer?.task || data.days[today]?.priority || 'One meaningful session'}</h2>
          <p className="muted">One topic. One tangible deliverable. Everything else can wait.</p>
        </>
      )}
      <div className="timer-line">
        <span className="timer-digits" role="timer" aria-label="Focus time remaining">
          {String(Math.floor(remain / 60)).padStart(2, '0')}
          <span>:</span>
          {String(remain % 60).padStart(2, '0')}
        </span>
        <div className="timer-controls">
          {!ready && (
            <button
              className="timer-play"
              onClick={toggle}
              aria-label={running ? 'Pause focus session' : 'Start focus session'}
            >
              {running ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}
            </button>
          )}
          {timer && (
            <button
              className="icon-button"
              aria-label="Reset focus timer"
              onClick={() =>
                update((d) => {
                  d.timer = null;
                })
              }
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
      {!timer ? (
        <div className="timer-presets">
          {[25, 60, 90].map((m) => (
            <button
              key={m}
              aria-pressed={minutes === m}
              className={minutes === m ? 'selected' : ''}
              onClick={() => setMinutes(m)}
            >
              {m} min
            </button>
          ))}
          <span>Your pace, your space.</span>
        </div>
      ) : (
        <div className="focus-meta">
          <small>
            {ready
              ? 'Your session is ready to reflect on.'
              : running
                ? 'Give this one thing your attention.'
                : 'Paused. Take the space you need.'}
          </small>
          {elapsed >= 1 && (
            <button
              className="text-button"
              onClick={() => {
                if (running)
                  update((d) => {
                    if (d.timer) {
                      d.timer.remaining = remain;
                      d.timer.deadline = null;
                    }
                  });
                setFinish(true);
              }}
            >
              {ready ? 'Complete session' : 'Finish & reflect'} <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </>
  );
  return (
    <>
      <div className="focus-box">{!full && content}</div>
      {full && (
        <div className="focus-overlay">
          {content}
          <div className="focus-sprout">
            <Sprout size={34} />
            <p>One focused session helps your garden grow.</p>
          </div>
        </div>
      )}
      {finish && (
        <Modal title="What moved forward?" onClose={() => setFinish(false)}>
          <p className="muted">
            {Math.floor(elapsed / 60)} minutes of attention. Capture the outcome, however small.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update((d) => {
                d.days[today] ??= emptyDay();
                d.sessions.push({
                  id: crypto.randomUUID(),
                  date: today,
                  seconds: elapsed,
                  output: output.trim(),
                  category: d.timer?.category || 'career',
                });
                d.timer = null;
              });
              setFinish(false);
              setFull(false);
              setOutput('');
              notify('Session saved. Progress over busyness.');
            }}
          >
            <Field label="A tangible result or lesson">
              <textarea
                required
                autoFocus
                rows={3}
                maxLength={2000}
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="What did you build, solve, understand or decide?"
              />
            </Field>
            {timer && (
              <Field label="Life area">
                <CategorySelect
                  value={timer.category}
                  onChange={(c) =>
                    update((d) => {
                      if (d.timer) d.timer.category = c;
                    })
                  }
                />
              </Field>
            )}
            <FormActions onClose={() => setFinish(false)} label="Save session" />
          </form>
        </Modal>
      )}
    </>
  );
}
export function Today({ now }: { now: Date }) {
  const { data, today, updateDay, setView, notify } = useApp();
  const [plan, setPlan] = useState('');
  const day = data.days[today] || emptyDay();
  const habits = scheduled(data, today);
  const score = dayScore(data, today);
  const xp = totalXP(data);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      timeZone: 'Asia/Singapore',
      hourCycle: 'h23',
    }).format(now),
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">
            <Sun size={14} />
            {dateLabel(today, { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
            <span className="tiny-dot" />{' '}
            {now.toLocaleTimeString('en-SG', {
              timeZone: 'Asia/Singapore',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            SGT
          </div>
          <h1>
            {greeting}, {data.settings.displayName || 'friend'}{' '}
            <span className="greeting-sun">☀</span>
          </h1>
          <p className="subtitle">A fresh little opportunity to grow what matters.</p>
        </div>
        <button className="button secondary" onClick={() => setPlan(addDays(today, 1))}>
          <Moon size={16} />
          Plan tomorrow
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="week-ribbon">
        <div className="week-message">
          <Sprout size={18} />
          <span>Small steps. Deep roots.</span>
        </div>
        <div className="week-days">
          {weekDates(today).map((date) => (
            <button
              key={date}
              className={`week-day ${date === today ? 'current' : ''} ${dayScore(data, date).done ? 'has-growth' : ''}`}
              aria-label={'View journal for ' + date}
              onClick={() => {
                sessionStorage.setItem('journal-date', date);
                setView('Journal');
              }}
            >
              <span>{dateLabel(date, { weekday: 'short' })}</span>
              <strong>{date.slice(-2)}</strong>
              <i>{dayScore(data, date).done ? <Check size={10} /> : null}</i>
            </button>
          ))}
        </div>
        <div className="week-note">
          You don’t need to do it all.
          <br />
          <strong>Just tend to what matters.</strong>
        </div>
      </div>
      <div className="today-layout">
        <div className="today-main">
          <section className="priority-card">
            <div className="section-heading">
              <span className="eyebrow">
                <span className="priority-star">✧</span> TODAY’S ONE IMPORTANT THING
              </span>
              <button
                className="icon-button"
                onClick={() => setPlan(today)}
                aria-label="Edit today's priority"
              >
                <Pencil size={16} />
              </button>
            </div>
            <h2>{day.priority || 'What deserves your best attention today?'}</h2>
            <p>
              {day.step ||
                'Choose one meaningful outcome. Then give yourself a simple place to start.'}
            </p>
            <div className="priority-bottom">
              <span className="tag">
                <span className="tiny-dot" />
                One thing at a time
              </span>
              <button className="text-button" onClick={() => setPlan(today)}>
                {day.priority ? 'Refine my first step' : 'Set my intention'}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <FocusTimer now={now} />
          <section className="card habits-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TEND TO YOUR DAY</span>
                <h2>Little habits, lasting change</h2>
              </div>
              <span className="count-pill">
                {score.done} / {score.total}
              </span>
            </div>
            <div className="habit-progress">
              <Progress value={score.percent} label="Today's habit completion" />
              <span>{score.percent}%</span>
            </div>
            <div className="habit-list">
              {habits.map((h) => (
                <HabitRow key={h.id} habit={h} date={today} />
              ))}
            </div>
            <div className="card-bottom">
              <span>
                <Moon size={13} />
                Use the moon for rest or recovery.
              </span>
              <button className="text-button" onClick={() => setView('Habits')}>
                Make it yours
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <section className="card rhythm-card">
            <div className="section-heading">
              <h2>Your gentle daily rhythm</h2>
              <Coffee size={20} />
            </div>
            <div className="rhythm">
              <div>
                <span className="rhythm-dot" />
                <small>6:30 – 7:00 AM</small>
                <strong>A slow start</strong>
                <p>Coffee, journal, a little reading. Thirty minutes to arrive.</p>
              </div>
              <div>
                <span className="rhythm-dot lavender" />
                <small>7:00 – 8:30 AM</small>
                <strong>Make something matter</strong>
                <p>One focused session, one tangible deliverable.</p>
              </div>
              <div>
                <span className="rhythm-dot peach" />
                <small>10:30 – 10:55 PM</small>
                <strong>Come back to calm</strong>
                <p>
                  Enjoy your show. Up to 30 minutes of YouTube; lights out by{' '}
                  {data.settings.bedtime}.
                </p>
              </div>
            </div>
          </section>
        </div>
        <div className="today-aside">
          <section className="plant-card">
            <div className="section-heading">
              <span className="eyebrow">YOUR LITTLE GARDEN</span>
              <Sparkles size={16} />
            </div>
            <Plant stage={Math.min(4, Math.floor(xp / 80))} />
            <h2>{xp < 80 ? 'Good things start small.' : 'Look at you growing.'}</h2>
            <p>
              {score.done
                ? 'Every little action is putting down roots. Your garden is growing with you.'
                : 'Your little sprout is ready. A little care today is all it takes.'}
            </p>
            <div className="plant-caption">
              <span className="status-dot" />
              Level {Math.floor(xp / 100) + 1} · {xp} lifetime XP
            </div>
            <button className="garden-link" onClick={() => setView('My Garden')}>
              Step into my garden
              <ArrowUpRight size={16} />
            </button>
          </section>
          <section className="card checkin-card">
            <span className="eyebrow">A MOMENT FOR YOU</span>
            <h2>How’s your inner weather?</h2>
            <p className="muted">However you feel, there’s room for it.</p>
            <div className="mood-buttons">
              {['Cloudy', 'Low', 'Okay', 'Good', 'Radiant'].map((label, i) => (
                <button
                  key={label}
                  aria-label={'Mood ' + (i + 1) + ': ' + label}
                  aria-pressed={day.mood === i + 1}
                  className={day.mood === i + 1 ? 'selected' : ''}
                  onClick={() => updateDay(today, { mood: day.mood === i + 1 ? undefined : i + 1 })}
                >
                  <span>{['☁', '☂', '◡', '☀', '✺'][i]}</span>
                  <small>{label}</small>
                </button>
              ))}
            </div>
            <label className="energy-label" htmlFor="energy">
              My energy <strong>{day.energy ? `${day.energy} / 5` : 'Not checked in'}</strong>
            </label>
            <input
              id="energy"
              className="energy-range"
              type="range"
              min="1"
              max="5"
              step="1"
              value={day.energy || 3}
              onChange={(e) => updateDay(today, { energy: Number(e.target.value) })}
            />
            <div className="range-labels">
              <span>Taking it slow</span>
              <span>Ready to go</span>
            </div>
          </section>
          <HabitDayScore compact />
          <section className="card notes-card">
            <div className="section-heading">
              <h2>A little brain space</h2>
              <Pencil size={16} />
            </div>
            <textarea
              aria-label="Quick journal notes"
              value={day.notes}
              maxLength={20000}
              rows={4}
              onChange={(e) => updateDay(today, { notes: e.target.value })}
              placeholder="A thought, a thank-you, something to let go of…"
            />
            <div className="card-bottom">
              <span>Saved as you go</span>
              <button className="text-button" onClick={() => setView('Journal')}>
                Open journal
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>
          <div className="evening-note">
            <Moon size={19} />
            <div>
              <strong>Tonight, protect your tomorrow.</strong>
              <p>
                Wind down gently. Aim for lights out before {data.settings.bedtime}. Tomorrow’s{' '}
                {data.settings.wake} wake-up follows adequate sleep.
              </p>
            </div>
          </div>
        </div>
      </div>
      {plan && <PlanDialog date={plan} onClose={() => setPlan('')} />}
    </>
  );
}
