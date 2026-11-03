'use client';
import { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  FileJson,
  FolderOpen,
  Leaf,
  Moon,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Sprout,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  weekday,
  type Finance,
} from '@/lib/model';
import { dataSchema } from '@/lib/validation';
import { download, Empty, Field, FormActions, Modal, money, Progress, useApp } from './ui';
import { PlanDialog } from './today';
import { ActivityBoard, HabitDayScore } from './activity-board';
function FinanceEditor({ snapshot, onClose }: { snapshot?: Finance; onClose: () => void }) {
  const { data, today, update, notify } = useApp();
  const fields = [
    'liquid',
    'accessible',
    'netWorth',
    'securities',
    'property',
    'etf',
    'contributions',
  ] as const;
  const [date, setDate] = useState(snapshot?.date || today);
  const [values, setValues] = useState<Record<(typeof fields)[number], string>>(
    () =>
      Object.fromEntries(fields.map((k) => [k, snapshot?.[k]?.toString() ?? ''])) as Record<
        (typeof fields)[number],
        string
      >,
  );
  const [notes, setNotes] = useState(snapshot?.notes || '');
  const [error, setError] = useState('');
  const labels: Record<string, string> = {
    liquid: 'Liquid assets including SRS',
    accessible: 'Liquid assets excluding SRS',
    netWorth: 'Total net worth',
    securities: 'Invested securities (optional)',
    property: 'Investment-property equity (optional)',
    etf: 'ETF allocation % (optional)',
    contributions: 'Year-to-date contributions (optional)',
  };
  return (
    <Modal
      title={snapshot ? 'Edit dated snapshot' : 'A monthly financial check-in'}
      onClose={onClose}
      wide
    >
      <p className="muted">
        All amounts in SGD. Leave unknown optional amounts blank. Record contributions cumulatively
        within the calendar year.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(values.accessible) > Number(values.liquid)) {
            setError('Liquid assets excluding SRS cannot exceed the total including SRS.');
            return;
          }
          if (data.finance.some((f) => f.date === date && f.id !== snapshot?.id)) {
            setError('A snapshot already exists for that date. Edit it from the history below.');
            return;
          }
          const f: Finance = {
            id: snapshot?.id || crypto.randomUUID(),
            date,
            liquid: Number(values.liquid),
            accessible: Number(values.accessible),
            netWorth: Number(values.netWorth),
            securities: values.securities === '' ? null : Number(values.securities),
            property: values.property === '' ? null : Number(values.property),
            etf: values.etf === '' ? null : Number(values.etf),
            contributions: values.contributions === '' ? null : Number(values.contributions),
            notes,
          };
          update((d) => {
            const i = d.finance.findIndex((x) => x.id === f.id);
            if (i >= 0) d.finance[i] = f;
            else d.finance.push(f);
          });
          notify('Snapshot saved. Steady steps toward freedom.');
          onClose();
        }}
      >
        <Field label="Snapshot date">
          <input
            type="date"
            required
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          {fields.map((k) => (
            <Field label={labels[k]} key={k}>
              <input
                type="number"
                min="0"
                max={k === 'etf' ? 100 : 1000000000000}
                step="any"
                required={['liquid', 'accessible', 'netWorth'].includes(k)}
                value={values[k]}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Context for these numbers">
          <textarea
            rows={3}
            maxLength={20000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <FormActions onClose={onClose} label="Save snapshot" />
      </form>
    </Modal>
  );
}
export function FinanceView() {
  const { data } = useApp();
  const [edit, setEdit] = useState<Finance | null | undefined>(undefined);
  const list = [...data.finance].sort((a, b) => a.date.localeCompare(b.date));
  const latest = list.at(-1);
  const previous = list.at(-2);
  const delta = latest && previous ? latest.liquid - previous.liquid : null;
  const contributions =
    latest &&
    previous &&
    latest.date.slice(0, 4) === previous.date.slice(0, 4) &&
    latest.contributions !== null &&
    previous.contributions !== null
      ? latest.contributions - previous.contributions
      : null;
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">GROWING YOUR FREEDOM</span>
          <h1>A little more optionality</h1>
          <p className="subtitle">A monthly perspective on financial independence.</p>
        </div>
        <button className="button primary" onClick={() => setEdit(null)}>
          <Plus size={17} />
          Monthly update
        </button>
      </div>
      <div className="info-strip">
        <ShieldCheck size={17} />
        <span>
          Manual, historical snapshots ·{' '}
          {latest
            ? 'latest as of ' +
              dateLabel(latest.date, { day: 'numeric', month: 'long', year: 'numeric' })
            : 'no data yet'}{' '}
          · no live prices or connected accounts
        </span>
      </div>
      {latest && (
        <>
          <div className="finance-metrics">
            <Metric
              label="LIQUID · INCLUDING SRS"
              value={money(latest.liquid)}
              detail="Your long-term FIRE measure"
            />
            <Metric
              label="LIQUID · EXCLUDING SRS"
              value={money(latest.accessible)}
              detail="Outside restricted SRS accounts"
            />
            <Metric
              label="RESTRICTED SRS"
              value={money(latest.liquid - latest.accessible)}
              detail="Included in the liquid total above"
            />
            <Metric
              label="TOTAL NET WORTH"
              value={money(latest.netWorth)}
              detail="Includes illiquid property equity"
            />
          </div>
          <div className="two-column">
            <section className="card fire-card">
              <span className="eyebrow">
                <Sprout size={15} /> YOUR PATH TO FINANCIAL FREEDOM
              </span>
              <h2>
                {money(latest.liquid)} <span>/ $2,000,000</span>
              </h2>
              <Progress value={(latest.liquid / 2000000) * 100} />
              <div className="metric-between">
                <strong>
                  {((latest.liquid / 2000000) * 100).toFixed(1)}% of the liquid-assets aspiration
                </strong>
                <span>{money(Math.max(0, 2000000 - latest.liquid))} to grow</span>
              </div>
              <p className="muted">
                Includes SRS. Property equity stays separate. This is progress against your personal
                aspiration, with no assumed return forecast.
              </p>
            </section>
            <section className="card">
              <h2>The shape of your snapshot</h2>
              <dl className="detail-list">
                <div>
                  <dt>Invested securities</dt>
                  <dd>{money(latest.securities)}</dd>
                </div>
                <div>
                  <dt>Investment-property equity</dt>
                  <dd>{money(latest.property)}</dd>
                </div>
                <div>
                  <dt>ETF allocation</dt>
                  <dd>{latest.etf === null ? 'Not recorded' : latest.etf + '%'}</dd>
                </div>
                <div>
                  <dt>{latest.date.slice(0, 4)} contributions to date</dt>
                  <dd>{money(latest.contributions)}</dd>
                </div>
              </dl>
            </section>
          </div>
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Steady growth, in perspective</h2>
                <p className="muted">Liquid assets including SRS · SGD</p>
              </div>
              {delta !== null && <span className="tag">Change: {money(delta)}</span>}
            </div>
            {list.length < 2 ? (
              <Empty title="Your first point is planted">
                Add another monthly snapshot to see a trend. A single snapshot can’t tell the story
                yet.
              </Empty>
            ) : (
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={list}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => dateLabel(v, { month: 'short', year: '2-digit' })}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => money(v, true)}
                      tickLine={false}
                      axisLine={false}
                      width={75}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Line
                      name="Liquid including SRS"
                      type="monotone"
                      dataKey="liquid"
                      stroke="#6a8861"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      name="Liquid excluding SRS"
                      type="monotone"
                      dataKey="accessible"
                      stroke="#b8a4c8"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="info-strip subtle">
              {contributions !== null && delta !== null
                ? `Between the latest two snapshots: contributions ${money(contributions)}; residual balance change ${money(delta - contributions)}. The residual may include returns, withdrawals, transfers and valuation changes; it is not pure investment gain.`
                : 'Contribution history is incomplete. Investment gains are not inferred from balance changes.'}
            </div>
          </section>
          <section className="card">
            <div className="section-heading">
              <h2>Snapshot history</h2>
              <span className="tag">
                {list.length} record{list.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>AS OF</th>
                    <th>LIQUID + SRS</th>
                    <th>OUTSIDE SRS</th>
                    <th>NET WORTH</th>
                    <th>EDIT</th>
                  </tr>
                </thead>
                <tbody>
                  {list
                    .slice()
                    .reverse()
                    .map((f) => (
                      <tr key={f.id}>
                        <td>
                          {dateLabel(f.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>{money(f.liquid)}</td>
                        <td>{money(f.accessible)}</td>
                        <td>{money(f.netWorth)}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={'Edit snapshot ' + f.date}
                            onClick={() => setEdit(f)}
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="muted small-text">{latest.notes}</p>
          </section>
        </>
      )}
      {!latest && (
        <Empty title="A clear starting point">
          Add a dated snapshot. You don’t need every number to begin.
        </Empty>
      )}
      {edit !== undefined && (
        <FinanceEditor snapshot={edit || undefined} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card metric-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function JournalView() {
  const { data, today, updateDay, update, notify } = useApp();
  const [date, setDate] = useState(() => {
    const d = sessionStorage.getItem('journal-date');
    sessionStorage.removeItem('journal-date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  });
  const [month, setMonth] = useState(date.slice(0, 7));
  const [plan, setPlan] = useState('');
  const [sleep, setSleep] = useState(false);
  const day = data.days[date] || emptyDay();
  const first = month + '-01';
  const calendar = Array.from({ length: 42 }, (_, i) =>
    addDays(first, i - ((weekday(first) + 6) % 7)),
  );
  const future = date > today;
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">NOTICE THE GOOD. LEARN. BEGIN AGAIN.</span>
          <h1>A place to come back to</h1>
          <p className="subtitle">Two minutes of reflection. A little more clarity.</p>
        </div>
        <button className="button secondary" onClick={() => setPlan(addDays(today, 1))}>
          <Moon size={16} />
          Plan tomorrow
        </button>
      </div>
      <div className="journal-layout">
        <aside className="card journal-calendar">
          <div className="section-heading">
            <h3>{dateLabel(first, { month: 'long', year: 'numeric' })}</h3>
            <div className="button-group">
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => setMonth(addDays(first, -1).slice(0, 7))}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => setMonth(addDays(first, 32).slice(0, 7))}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <small key={i}>{d}</small>
            ))}
            {calendar.map((d) => (
              <button
                key={d}
                disabled={d > addDays(today, 1)}
                className={`${d.slice(0, 7) !== month ? 'outside' : ''} ${d === date ? 'selected' : ''} ${data.days[d] ? 'recorded' : ''}`}
                aria-label={'Journal ' + d}
                onClick={() => setDate(d)}
              >
                {Number(d.slice(-2))}
                <i />
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() => {
              setDate(today);
              setMonth(today.slice(0, 7));
            }}
          >
            Come back to today
            <ArrowRight size={14} />
          </button>
          <hr />
          <span className="eyebrow">NOTICING, NOT JUDGING</span>
          <p className="muted">An empty day is simply an empty day. You can always begin again.</p>
          <div className="journal-stat">
            <Sprout size={20} />
            <strong>
              {
                Object.values(data.days).filter(
                  (d) => d.notes.trim() || d.wins.trim() || d.weekly.trim(),
                ).length
              }
            </strong>
            <span>days with written reflections</span>
          </div>
        </aside>
        <div>
          <div className="journal-date-heading">
            <h2>{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <span className="tag">
              {date === today
                ? 'Today'
                : future
                  ? 'A plan for tomorrow'
                  : 'A page from your journey'}
            </span>
          </div>
          <section className="card">
            <span className="eyebrow">☀ MORNING · ARRIVE WITH INTENTION</span>
            <Field label="My one important thing">
              <input
                maxLength={500}
                value={day.priority}
                placeholder="One meaningful outcome…"
                onChange={(e) => updateDay(date, { priority: e.target.value })}
              />
            </Field>
            <Field label="My first concrete action">
              <input
                maxLength={2000}
                value={day.step}
                placeholder="Make the starting point small and specific."
                onChange={(e) => updateDay(date, { step: e.target.value })}
              />
            </Field>
            {!future && (
              <>
                <div className="form-grid">
                  <Field label="Mood">
                    <select
                      value={day.mood || ''}
                      onChange={(e) =>
                        updateDay(date, {
                          mood: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    >
                      <option value="">Not checked in</option>
                      {['Cloudy', 'Low', 'Okay', 'Good', 'Radiant'].map((s, i) => (
                        <option key={s} value={i + 1}>
                          {i + 1} · {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Energy">
                    <select
                      value={day.energy || ''}
                      onChange={(e) =>
                        updateDay(date, {
                          energy: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    >
                      <option value="">Not checked in</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="How am I feeling? What’s on my mind?">
                  <textarea
                    rows={4}
                    maxLength={20000}
                    value={day.notes}
                    onChange={(e) => updateDay(date, { notes: e.target.value })}
                    placeholder="Let a few honest thoughts land here."
                  />
                </Field>
              </>
            )}
          </section>
          {!future && (
            <>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">☾ REST IS PART OF THE WORK</span>
                    <h2>The night ending {dateLabel(date)}</h2>
                  </div>
                  <button className="text-button" onClick={() => setSleep(true)}>
                    <Pencil size={14} />
                    Record sleep
                  </button>
                </div>
                <p className="muted">
                  {day.sleepStart && day.sleepEnd
                    ? `${day.sleepStart.replace('T', ' at ')} → ${day.sleepEnd.replace('T', ' at ')} · ${((new Date(day.sleepEnd + '+08:00').getTime() - new Date(day.sleepStart + '+08:00').getTime()) / 3600000).toFixed(1)} hours`
                    : 'No actual sleep recorded for this wake-up date. Tonight’s bedtime remains a plan.'}
                </p>
              </section>
              <section className="card">
                <span className="eyebrow">☾ EVENING · A GENTLE LOOK BACK</span>
                {[
                  ['wins', 'What went well?'],
                  ['progress', 'What meaningful progress did I make?'],
                  ['obstacles', 'What didn’t go well, and why?'],
                  ['lesson', 'What did I learn?'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <textarea
                      rows={2}
                      maxLength={20000}
                      value={day[key as 'wins' | 'progress' | 'obstacles' | 'lesson']}
                      onChange={(e) => updateDay(date, { [key]: e.target.value })}
                      placeholder={
                        key === 'wins' ? 'Small wins count, too.' : 'A sentence or two is enough.'
                      }
                    />
                  </Field>
                ))}
                <p className="muted small-text">
                  Habits followed:{' '}
                  {scheduled(data, date)
                    .filter((h) => completed(h, day.logs[h.id]))
                    .map((h) => h.name)
                    .join(', ') || 'No completions recorded yet.'}
                </p>
                <button className="button secondary" onClick={() => setPlan(addDays(date, 1))}>
                  Choose tomorrow’s one thing
                  <ArrowRight size={15} />
                </button>
              </section>
              <section className="card">
                <span className="eyebrow">WEEKLY · ZOOM OUT A LITTLE</span>
                <h2>How is your system serving you?</h2>
                <p className="muted">
                  {weekDates(date)
                    .filter((d) => d <= today)
                    .reduce((n, d) => n + dayScore(data, d).done, 0)}{' '}
                  habit completions this week. What helped? What felt too heavy? What one adjustment
                  would make next week kinder and more effective?
                </p>
                <textarea
                  aria-label="Weekly reflection"
                  rows={4}
                  maxLength={20000}
                  value={day.weekly}
                  onChange={(e) => updateDay(date, { weekly: e.target.value })}
                  placeholder="My wins, patterns, obstacles, and one adjustment…"
                />
              </section>
            </>
          )}
        </div>
      </div>
      {plan && <PlanDialog date={plan} onClose={() => setPlan('')} />}
      {sleep && <SleepDialog date={date} onClose={() => setSleep(false)} />}
    </>
  );
}
function SleepDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update, notify } = useApp();
  const day = data.days[date];
  const [error, setError] = useState('');
  return (
    <Modal title={'Sleep · woke on ' + dateLabel(date)} onClose={onClose}>
      <p className="muted">
        Use actual times in Singapore. The bedtime may be the previous calendar day. Your sleep
        target is {data.settings.sleepHours} hours.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const start = String(form.get('sleepStart') || '');
          const end = String(form.get('sleepEnd') || '');
          if (start || end) {
            const a = Date.parse(start + '+08:00'),
              b = Date.parse(end + '+08:00');
            if (
              !start ||
              !end ||
              !Number.isFinite(a) ||
              !Number.isFinite(b) ||
              end.slice(0, 10) !== date ||
              b <= a ||
              b > Date.now() ||
              b - a > 24 * 3600000
            ) {
              setError(
                'Use a real completed sleep period of at most 24 hours, with the wake-up on ' +
                  date +
                  '.',
              );
              return;
            }
          }
          update((d) => {
            d.days[date] ??= emptyDay();
            d.days[date].sleepStart = start || undefined;
            d.days[date].sleepEnd = end || undefined;
            const sleepHabit = scheduled(d, date).find((h) => h.id === 'sleep');
            if (sleepHabit)
              d.days[date].logs.sleep =
                start &&
                end &&
                (Date.parse(end + '+08:00') - Date.parse(start + '+08:00')) / 3600000 >=
                  d.settings.sleepHours
                  ? sleepHabit.target
                  : 0;
          });
          notify('Sleep saved on its wake-up date.');
          onClose();
        }}
      >
        <Field label="Fell asleep (actual)">
          <input type="datetime-local" name="sleepStart" defaultValue={day?.sleepStart || ''} />
        </Field>
        <Field label="Woke up (actual)">
          <input type="datetime-local" name="sleepEnd" defaultValue={day?.sleepEnd || ''} />
        </Field>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <FormActions onClose={onClose} label="Save sleep" />
      </form>
    </Modal>
  );
}
export function InsightsView() {
  const { data, today, setView } = useApp();
  const week = weekDates(today).filter((d) => d <= today && d >= data.startedOn);
  const scores = week.map((d) => dayScore(data, d));
  const done = scores.reduce((s, x) => s + x.done, 0);
  const total = scores.reduce((s, x) => s + x.total, 0);
  const xp = totalXP(data);
  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
    .filter((d) => d >= data.startedOn)
    .map((date) => ({
      date,
      consistency: dayScore(data, date).percent,
      energy: data.days[date]?.energy ?? null,
      mood: data.days[date]?.mood ?? null,
      focus: Math.round(
        data.sessions.filter((s) => s.date === date).reduce((n, s) => n + s.seconds / 60, 0),
      ),
    }));
  const recorded = chart.filter((r) => data.days[r.date]);
  const sleepNights = Object.keys(data.days).filter((date) => {
    const h = scheduled(data, date).find((h) => h.id === 'sleep');
    return h && completed(h, data.days[date].logs.sleep);
  }).length;
  const badges = [
    {
      name: 'First little step',
      description: 'Complete your first scheduled habit.',
      earned: Object.keys(data.days).some((d) => dayScore(data, d).done > 0),
      icon: '🌱',
    },
    {
      name: 'A moment of focus',
      description: 'Record a focus session of at least one minute.',
      earned: data.sessions.some((s) => s.seconds >= 60),
      icon: '☀',
    },
    {
      name: 'Rested roots',
      description: 'Meet your sleep target on three nights.',
      earned: sleepNights >= 3,
      icon: '☾',
    },
    {
      name: 'A gentle look back',
      description: 'Write a weekly reflection.',
      earned: Object.values(data.days).some((d) => !!d.weekly.trim()),
      icon: '✧',
    },
    {
      name: 'First product sprint',
      description: 'Achieve an entrepreneurship goal.',
      earned: data.goals.some((g) => g.category === 'startup' && g.status === 'Achieved'),
      icon: '🌷',
    },
  ];
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CURIOSITY, NOT A REPORT CARD</span>
          <h1>Notice how you’re growing</h1>
          <p className="subtitle">Real patterns from the little things you record.</p>
        </div>
        <span className="tag sage">
          <Sparkles size={14} />
          Level {Math.floor(xp / 100) + 1}
        </span>
      </div>
      <HabitDayScore />
      <ActivityBoard />
      <div className="finance-metrics">
        <Metric
          label="WEEKLY CONSISTENCY"
          value={total ? `${Math.round((done / total) * 100)}%` : '—'}
          detail={`${done} completed / ${total} scheduled so far`}
        />
        <Metric label="LIFETIME GROWTH" value={`${xp} XP`} detail="No missed-day penalties" />
        <Metric
          label="FOCUS OUTCOMES"
          value={String(data.sessions.length)}
          detail="Sessions with a written result"
        />
        <Metric
          label="GOALS ACHIEVED"
          value={String(data.goals.filter((g) => g.status === 'Achieved').length)}
          detail="Recorded goal outcomes"
        />
      </div>
      <p className="formula">
        Consistency = completed scheduled habits ÷ scheduled habits × 100, from Monday through today
        and no earlier than tracking began. Excused or paused habits and future days are excluded.
        Today’s unfinished habits are still opportunities.
      </p>
      <section className="card">
        <div className="section-heading">
          <h2>A fortnight in your garden</h2>
          <span className="tag">{recorded.length} days with records</span>
        </div>
        {recorded.length < 2 ? (
          <Empty title="Your story is just beginning">
            Record a few days to see completion trends. We won’t invent a pattern from a single day.
          </Empty>
        ) : (
          <div className="chart">
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => dateLabel(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="consistency"
                  name="Scheduled habits completed (%)"
                  stroke="#74936b"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <div className="two-column">
        <section className="card">
          <h2>A balanced kind of progress</h2>
          <p className="muted">
            Completed actions this week, by area. These counts reflect activity, not value or
            business impact.
          </p>
          <div className="balance-list">
            {categories.map((c) => {
              const count = week.reduce(
                (sum, date) =>
                  sum +
                  scheduled(data, date).filter(
                    (h) => h.category === c.id && completed(h, data.days[date]?.logs[h.id]),
                  ).length,
                0,
              );
              return (
                <div key={c.id}>
                  <span className={`balance-dot ${c.color}`} />
                  <span>{c.short}</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <span className="eyebrow">SLEEP, ENERGY & FOCUS</span>
          <h2>Let the evidence grow</h2>
          <p className="muted">
            {Object.values(data.days).filter((d) => d.sleepStart && d.sleepEnd && d.energy).length}{' '}
            days have both actual sleep and energy records. We need at least 7 paired days to make a
            useful comparison.
          </p>
          <p className="muted">
            {recorded.filter((d) => d.energy !== null).length} energy check-ins ·{' '}
            {data.sessions.length} focus sessions. More time at a desk doesn’t necessarily mean more
            meaningful progress.
          </p>
          <button className="text-button" onClick={() => setView('Journal')}>
            Add a reflection
            <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="card">
        <span className="eyebrow">LITTLE REASONS TO CELEBRATE</span>
        <h2>Milestones along the way</h2>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.name} className={`badge-card ${b.earned ? 'earned' : 'locked'}`}>
              <span className="badge-illustration">{b.icon}</span>
              <h3>{b.name}</h3>
              <p>{b.description}</p>
              <small>{b.earned ? 'Earned with care' : 'Room to grow'}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
export function SettingsView() {
  const { data, update, status, paths, mirrorError, notify, today } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<typeof data | null>(null);
  const [error, setError] = useState('');
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">YOUR SPACE. YOUR DATA.</span>
          <h1>A little housekeeping</h1>
          <p className="subtitle">Keep your garden safe, comfortable and entirely yours.</p>
        </div>
        <ShieldCheck size={30} />
      </div>
      <div className="two-column">
        <section className="card">
          <div className="section-heading">
            <h2>
              <Database size={20} />
              Local SQLite
            </h2>
            <span className="tag sage">{status}</span>
          </div>
          <p>
            Your garden lives on this Mac. Every save is a SQLite transaction, with revision checks
            to protect against conflicting browser tabs.
          </p>
          <code className="path-display">{paths.dbPath}</code>
          <p className="muted small-text">
            Tables include daily_notes, habits, habit_logs, goals, financial_snapshots and
            focus_sessions. JSON backups preserve the complete app state, including habit schedule
            history.
          </p>
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>
              <FolderOpen size={20} />
              Obsidian mirror
            </h2>
            <span className={`tag ${mirrorError ? 'peach' : 'sage'}`}>
              {mirrorError ? 'Needs attention' : 'One-way mirror'}
            </span>
          </div>
          <code className="path-display">{paths.mirrorPath}</code>
          <p className="muted">
            Generated Markdown includes YAML properties, linked life areas, daily notes, goals,
            finance snapshots and Obsidian Bases views. Add annotations in each note’s Personal
            notes section.
          </p>
          <p className="muted small-text">
            Set OBSIDIAN_VAULT_PATH in .env.local to your vault’s absolute path, then restart the
            server. Life Garden uses its own subfolder. SQLite stays the source of truth; edits to
            generated Markdown don’t sync back.
          </p>
        </section>
        <section className="card">
          <h2>
            <FileJson size={20} />
            Back up your garden
          </h2>
          <p className="muted">
            Download a complete JSON backup before restoring data or moving Macs.
          </p>
          <div className="stack-actions">
            <button
              className="button primary"
              onClick={() => {
                download(`life-garden-${today}.json`, JSON.stringify(data, null, 2));
                notify('Your garden, ready to take with you.');
              }}
            >
              <ArrowDownToLine size={16} />
              Export full backup
            </button>
            <button
              className="button secondary"
              onClick={() => {
                const rows = [
                  ['date', 'habit_id', 'habit_name', 'category', 'value', 'unit', 'excused'],
                ];
                for (const [date, day] of Object.entries(data.days)) {
                  for (const [id, value] of Object.entries(day.logs)) {
                    const r = data.habits
                      .find((h) => h.id === id)
                      ?.revisions.filter((r) => r.from <= date)
                      .at(-1);
                    rows.push([
                      date,
                      id,
                      r?.name || id,
                      r?.category || '',
                      value === 'rest' ? '' : String(value),
                      r?.unit || '',
                      String(value === 'rest'),
                    ]);
                  }
                }
                const escape = (v: string) =>
                  '"' + v.replaceAll('"', '""').replace(/^[=+@-]/, "'$&") + '"';
                download(
                  `life-garden-habits-${today}.csv`,
                  rows.map((r) => r.map(escape).join(',')).join('\r\n'),
                  'text/csv',
                );
              }}
            >
              <ArrowDownToLine size={16} />
              Export habit CSV
            </button>
            <button className="button secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              Restore a JSON backup
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/json,.json"
            onChange={async (e) => {
              setError('');
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 5_000_000) {
                setError('The maximum backup size is 5 MB.');
                return;
              }
              try {
                const result = dataSchema.safeParse(JSON.parse(await f.text()));
                if (!result.success)
                  throw new Error(result.error.issues[0]?.message || 'Invalid backup.');
                setPending(result.data);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not read backup.');
              }
            }}
          />
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </section>
        <section className="card">
          <h2>
            <Moon size={20} />A sustainable rhythm
          </h2>
          <p className="muted">
            These are intentions. Your actual sleep is logged separately in your journal.
          </p>
          <Field label="What should your garden call you?">
            <input
              maxLength={80}
              value={data.settings.displayName || ''}
              placeholder="Your name"
              onChange={(e) =>
                update((d) => {
                  d.settings.displayName = e.target.value;
                })
              }
            />
          </Field>
          <Field label="Lights out target (SGT)">
            <input
              type="time"
              value={data.settings.bedtime}
              onChange={(e) => {
                if (e.target.value)
                  update((d) => {
                    d.settings.bedtime = e.target.value;
                  });
              }}
            />
          </Field>
          <Field label="Wake-up target (SGT)">
            <input
              type="time"
              value={data.settings.wake}
              onChange={(e) => {
                if (e.target.value)
                  update((d) => {
                    d.settings.wake = e.target.value;
                  });
              }}
            />
          </Field>
          <Field label="Sufficient sleep target (hours)">
            <input
              type="number"
              min="1"
              max="16"
              step="0.5"
              value={data.settings.sleepHours}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= 16)
                  update((d) => {
                    d.settings.sleepHours = v;
                  });
              }}
            />
          </Field>
          <p className="muted small-text">
            A target wake-up always follows adequate rest. No need to trade sleep for a perfect
            morning.
          </p>
        </section>
      </div>
      {pending && (
        <Modal title="Restore this garden?" onClose={() => setPending(null)}>
          <p>
            This backup has {Object.keys(pending.days).length} daily records,{' '}
            {pending.habits.length} habits, {pending.goals.length} goals and{' '}
            {pending.finance.length} financial snapshots. It will replace the current SQLite
            records.
          </p>
          <p className="muted">
            Existing Obsidian notes are never deleted during a restore. Export your current garden
            first if you want to keep it.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() =>
                download(`life-garden-before-restore-${today}.json`, JSON.stringify(data, null, 2))
              }
            >
              Export current data
            </button>
            <button
              className="button primary"
              onClick={() => {
                update((d) => Object.assign(d, pending));
                setPending(null);
                notify('Garden restored. Welcome back.');
              }}
            >
              Restore backup
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
