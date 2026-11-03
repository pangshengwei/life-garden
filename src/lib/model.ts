export const categories = [
  {
    id: 'career',
    name: 'Career & AI Mastery',
    short: 'Career & AI',
    color: 'lavender',
    icon: 'Brain',
    description: 'Build valuable skills. Create meaningful impact.',
  },
  {
    id: 'startup',
    name: 'Entrepreneurship',
    short: 'Building & shipping',
    color: 'peach',
    icon: 'Rocket',
    description: 'Small experiments. Real people. Useful products.',
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    short: 'Health & fitness',
    color: 'sage',
    icon: 'Heart',
    description: 'Sleep, nourish, move, and make room for recovery.',
  },
  {
    id: 'wealth',
    name: 'Wealth & Financial Independence',
    short: 'Wealth & freedom',
    color: 'yellow',
    icon: 'Wallet',
    description: 'Build freedom steadily, one thoughtful step at a time.',
  },
  {
    id: 'relationships',
    name: 'Relationships & Experiences',
    short: 'People & experiences',
    color: 'pink',
    icon: 'Users',
    description: 'Be present for the people and moments that matter.',
  },
  {
    id: 'growth',
    name: 'Personal Growth & Hobbies',
    short: 'Growth & hobbies',
    color: 'blue',
    icon: 'BookOpen',
    description: 'Stay curious. Enjoy the journey.',
  },
] as const;
export type Category = (typeof categories)[number]['id'];
export type HabitType = 'check' | 'count' | 'minutes' | 'number';
export type HabitRevision = {
  from: string;
  name: string;
  category: Category;
  days: number[];
  paused: boolean;
  type: HabitType;
  target: number;
  unit: string;
};
export type Habit = { id: string; revisions: HabitRevision[]; archived?: boolean };
export type HabitDefinition = HabitRevision & { id: string };
export type Day = {
  priority: string;
  step: string;
  mood?: number;
  energy?: number;
  notes: string;
  wins: string;
  progress: string;
  obstacles: string;
  lesson: string;
  weekly: string;
  logs: Record<string, number | 'rest'>;
  sleepStart?: string;
  sleepEnd?: string;
};
export type Goal = {
  id: string;
  title: string;
  category: Category;
  horizon: 'Annual' | 'Quarterly' | 'Monthly' | 'Weekly';
  status: 'In progress' | 'Achieved' | 'Aspirational';
  current: number;
  target: number;
  unit: string;
  due: string;
  parentId: string;
  archived: boolean;
  notes: string;
};
export type Finance = {
  id: string;
  date: string;
  liquid: number;
  accessible: number;
  netWorth: number;
  securities: number | null;
  property: number | null;
  etf: number | null;
  contributions: number | null;
  notes: string;
};
export type FocusSession = {
  id: string;
  date: string;
  seconds: number;
  output: string;
  category: Category;
};
export type Timer = {
  duration: number;
  remaining: number;
  deadline: number | null;
  task: string;
  category: Category;
};
export type GoalEvent = {
  id: string;
  goalId: string;
  date: string;
  title: string;
  category: Category;
  previous: number;
  current: number;
  target: number;
  unit: string;
  achieved: boolean;
  wasAchieved?: boolean;
};
export type GardenData = {
  version: 1;
  startedOn: string;
  habits: Habit[];
  days: Record<string, Day>;
  goals: Goal[];
  goalEvents?: GoalEvent[];
  finance: Finance[];
  sessions: FocusSession[];
  timer: Timer | null;
  theme: 'light' | 'dark';
  settings: { bedtime: string; wake: string; sleepHours: number; displayName?: string };
};
export const emptyDay = (): Day => ({
  priority: '',
  step: '',
  notes: '',
  wins: '',
  progress: '',
  obstacles: '',
  lesson: '',
  weekly: '',
  logs: {},
});
export function dateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function addDays(key: string, amount: number) {
  const d = new Date(key + 'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate() + amount);
  return dateKey(d);
}
export function weekday(key: string) {
  return new Date(key + 'T12:00:00+08:00').getUTCDay();
}
export function dateLabel(
  key: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return new Date(key + 'T12:00:00+08:00').toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    ...options,
  });
}
export function definition(habit: Habit, date: string): HabitDefinition | undefined {
  const revision = habit.revisions.filter((r) => r.from <= date).at(-1);
  return revision ? { ...revision, id: habit.id } : undefined;
}
/** Change a habit from a date onward without rewriting earlier schedules or names. */
export function reviseHabit(habit: Habit, revision: HabitRevision, date: string) {
  habit.revisions = [...habit.revisions.filter((r) => r.from < date), { ...revision, from: date }];
}
/** Removal is reversible; a paused revision keeps removed dates out of habit scores. */
export function setHabitArchived(habit: Habit, archived: boolean, date: string) {
  const current = definition(habit, date);
  if (!current) throw new Error('This habit has no definition for the selected date.');
  reviseHabit(habit, { ...current, paused: archived }, date);
  habit.archived = archived;
}
export function scheduled(data: GardenData, date: string): HabitDefinition[] {
  return data.habits
    .map((h) => definition(h, date))
    .filter((h): h is HabitDefinition => !!h && !h.paused && h.days.includes(weekday(date)));
}
export function completed(h: HabitDefinition, value: number | 'rest' | undefined) {
  return typeof value === 'number' && value >= h.target;
}
export function dayScore(data: GardenData, date: string) {
  const habits = scheduled(data, date).filter((h) => data.days[date]?.logs[h.id] !== 'rest');
  const done = habits.filter((h) => completed(h, data.days[date]?.logs[h.id])).length;
  return {
    done,
    total: habits.length,
    percent: habits.length ? Math.round((done / habits.length) * 100) : 0,
  };
}
export function weekDates(today: string) {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function totalXP(data: GardenData) {
  let xp = 0;
  for (const [date, day] of Object.entries(data.days)) {
    xp += scheduled(data, date).filter((h) => completed(h, day.logs[h.id])).length * 10;
    if (day.wins.trim() && day.lesson.trim()) xp += 15;
    if (day.weekly.trim()) xp += 20;
  }
  xp += new Set(data.sessions.filter((s) => s.seconds >= 60).map((s) => s.date)).size * 20;
  xp += data.goals.filter((g) => g.status === 'Achieved').length * 30;
  return xp;
}
export function initialData(today: string): GardenData {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const habits: Array<[string, string, Category, number[], HabitType, number, string]> = [
    ['sleep', 'Sufficient sleep', 'health', all, 'check', 1, ''],
    ['journal', 'Morning journal', 'growth', all, 'check', 1, ''],
    ['focus', 'Meaningful focused work', 'career', all, 'minutes', 60, 'min'],
    ['food', 'Eat well, feel well', 'health', all, 'check', 1, ''],
    ['connection', 'A moment of real connection', 'relationships', all, 'check', 1, ''],
    ['screens', 'Intentional evening entertainment', 'health', all, 'check', 1, ''],
    ['reflect', 'Evening reflection', 'growth', all, 'check', 1, ''],
    ['coding', 'Coding practice', 'career', [1, 4], 'count', 1, 'problem'],
    ['design', 'System design', 'career', [2], 'minutes', 45, 'min'],
    ['ship', 'Build, validate & ship', 'startup', [2, 4], 'minutes', 60, 'min'],
    ['learn', 'RL / AI learning', 'career', [6], 'minutes', 45, 'min'],
    ['cardio', 'Wednesday cardio', 'health', [3], 'minutes', 20, 'min'],
    ['gym', 'Friday gym', 'health', [5], 'check', 1, ''],
    ['outdoor', 'Weekend hike or run', 'health', [6], 'check', 1, ''],
    ['trading', 'Structured paper-trading review', 'wealth', [0], 'minutes', 60, 'min'],
  ];
  return {
    version: 1,
    startedOn: today,
    days: {},
    sessions: [],
    timer: null,
    theme: 'light',
    settings: { bedtime: '23:00', wake: '06:30', sleepHours: 7.5 },
    habits: habits.map(([id, name, category, days, type, target, unit]) => ({
      id,
      revisions: [{ from: today, name, category, days, type, target, unit, paused: false }],
    })),
    goals: categories.map((c) => ({
      id: 'starter-' + c.id,
      title: {
        career: 'Grow a valuable skill',
        startup: 'Validate a useful product',
        health: 'Build a sustainable health rhythm',
        wealth: 'Define a financial independence plan',
        relationships: 'Make time for meaningful connection',
        growth: 'Make room for curiosity',
      }[c.id],
      category: c.id,
      horizon: 'Annual',
      status: 'Aspirational',
      current: 0,
      target: 1,
      unit: 'outcome',
      due: today.slice(0, 4) + '-12-31',
      parentId: '',
      archived: false,
      notes: 'Choose a personal outcome and the evidence that would show progress.',
    })),
    goalEvents: [],
    finance: [],
  };
}
