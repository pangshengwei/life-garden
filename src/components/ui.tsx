'use client';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { X, Brain, Rocket, Heart, Wallet, Users, BookOpen, Sprout } from 'lucide-react';
import { useGarden } from '@/lib/use-garden';
import { categories, type Category } from '@/lib/model';
export type View =
  'Today' | 'My Garden' | 'Goals' | 'Habits' | 'Finance' | 'Journal' | 'Insights' | 'Settings';
export type AppContextType = ReturnType<typeof useGarden> & {
  today: string;
  view: View;
  setView: (v: View) => void;
  category: Category | null;
  setCategory: (c: Category | null) => void;
  notify: (text: string) => void;
};
export const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx || !ctx.data) throw new Error('Garden unavailable');
  return { ...ctx, data: ctx.data };
}
export const iconMap = { Brain, Rocket, Heart, Wallet, Users, BookOpen };
export function CategoryIcon({ category, size = 19 }: { category: Category; size?: number }) {
  const c = categories.find((c) => c.id === category)!;
  const Icon = iconMap[c.icon];
  return (
    <span className={`category-icon ${c.color}`}>
      <Icon size={size} />
    </span>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label || 'Progress'}
      aria-valuenow={Math.min(100, Math.max(0, value))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    el?.querySelector<HTMLElement>('[autofocus]')?.focus();
    return () => el?.close();
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <Sprout size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function money(value: number | null, compact = false) {
  if (value === null) return 'Not recorded';
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
    ...(compact ? { notation: 'compact' as const } : {}),
  }).format(value);
}
export function download(filename: string, contents: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function FormActions({
  onClose,
  label = 'Save changes',
}: {
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="form-actions">
      <button type="button" className="button secondary" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className="button primary">
        {label}
      </button>
    </div>
  );
}
export function CategorySelect({
  value,
  onChange,
}: {
  value: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Category)}>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
