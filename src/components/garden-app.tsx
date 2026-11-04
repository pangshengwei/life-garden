'use client';
import { useEffect, useState } from 'react';
import {
  Sun,
  Sprout,
  LayoutDashboard,
  Flower2,
  Flag,
  CheckCheck,
  Wallet,
  NotebookPen,
  ChartNoAxesCombined,
  Settings,
  Moon,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { dateKey, dateLabel, totalXP, type Category } from '@/lib/model';
import { useGarden } from '@/lib/use-garden';
import { AppContext, download, Progress, type View } from './ui';
import { Today } from './today';
import { GoalsView, HabitsView, GardenView } from './progress-views';
import { FinanceView, JournalView, InsightsView, SettingsView } from './record-views';
const nav = [
  ['Today', LayoutDashboard],
  ['My Garden', Flower2],
  ['Goals', Flag],
  ['Habits', CheckCheck],
  ['Finance', Wallet],
  ['Journal', NotebookPen],
  ['Insights', ChartNoAxesCombined],
] as const;
export function GardenApp() {
  const garden = useGarden();
  const [view, setView] = useState<View>('Today');
  const [category, setCategory] = useState<Category | null>(null);
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = garden.data?.theme || 'light';
  }, [garden.data?.theme]);
  const today = now ? dateKey(now) : '';
  const xp = garden.data ? totalXP(garden.data) : 0;
  const navigate = (v: View) => {
    setView(v);
    setMenu(false);
  };
  return (
    <AppContext.Provider
      value={{ ...garden, today, view, setView: navigate, category, setCategory, notify: setToast }}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('Today');
          }}
        >
          <span className="brand-mark">
            <Sprout size={26} />
          </span>
          <span>
            life garden<span className="brand-dot">.</span>
            <small>A LITTLE GROWTH, EVERY DAY</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="nav-caption">YOUR LITTLE CORNER</div>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${view === name ? 'active' : ''}`}
              aria-current={view === name ? 'page' : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {name}
              {name === 'Today' && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="level-card">
            <span className="level-icon">✧</span>
            <div>
              <strong>
                Level {Math.floor(xp / 100) + 1} · {xp < 100 ? 'Seedling' : 'Growing roots'}
              </strong>
              <small>{xp % 100} / 100 XP to next level</small>
            </div>
            <Progress value={xp % 100} />
          </div>
          <button
            className={`nav-item ${view === 'Settings' ? 'active' : ''}`}
            onClick={() => navigate('Settings')}
          >
            <Settings size={19} />
            Settings & backups
          </button>
          <div className="sidebar-profile">
            <span className="avatar">S</span>
            <div>
              <strong>Your personal space</strong>
              <small>
                <span className="status-dot" />
                {garden.hosted ? 'Private · hosted on Railway' : 'SQLite · on this Mac'}
              </small>
            </div>
          </div>
        </div>
      </aside>
      {menu && <div className="nav-scrim" onClick={() => setMenu(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>My space</span>
            <span className="slash">/</span>
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-status" role="status">
              <span className={`status-dot ${garden.error ? 'warning' : ''}`} />
              {garden.status}
            </span>
            <span className="topbar-date">
              {today && dateLabel(today, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${garden.data?.theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={() =>
                garden.update((d) => {
                  d.theme = d.theme === 'dark' ? 'light' : 'dark';
                })
              }
            >
              {garden.data?.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {garden.error && (
            <div className="error-banner" role="alert">
              {garden.error}
              <div>
                <button onClick={() => void garden.retry()}>Retry</button>
                {garden.data && (
                  <button
                    onClick={() =>
                      download(
                        `life-garden-unsaved-${today}.json`,
                        JSON.stringify(garden.data, null, 2),
                      )
                    }
                  >
                    Export unsaved data
                  </button>
                )}
                <button onClick={() => location.reload()}>Reload</button>
              </div>
            </div>
          )}
          {garden.mirrorError && (
            <div className="error-banner" role="alert">
              SQLite saved. Obsidian mirror needs attention: {garden.mirrorError}
              <button onClick={() => navigate('Settings')}>View storage</button>
            </div>
          )}
          {!garden.data || !today ? (
            <div className="loading">
              <Sprout size={40} />
              <p>Making a little space for you…</p>
            </div>
          ) : (
            <div key={view} className="page-enter">
              {view === 'Today' ? (
                <Today now={now!} />
              ) : view === 'My Garden' ? (
                <GardenView />
              ) : view === 'Goals' ? (
                <GoalsView />
              ) : view === 'Habits' ? (
                <HabitsView />
              ) : view === 'Finance' ? (
                <FinanceView />
              ) : view === 'Journal' ? (
                <JournalView />
              ) : view === 'Insights' ? (
                <InsightsView />
              ) : (
                <SettingsView />
              )}
            </div>
          )}
          <footer className="page-footer">
            <Sprout size={14} />
            <span>Compound what matters. Simplify everything else.</span>
            <span className="footer-private">
              <ShieldCheck size={13} />A little space, just for you.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Sprout size={18} />
          {toast}
        </div>
      )}
    </AppContext.Provider>
  );
}
