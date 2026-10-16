import React from 'react';
import { AlertCircle, RotateCcw, Save, X } from 'lucide-react';
import {
  useAdminSettingsStore,
  type AdminSettings,
  type SettingsSectionKey,
} from '../../../store/adminSettingsStore';

// ============================================================
// Shared building blocks for the Admin Settings sections.
// Everything here reuses the FlowExec design tokens (card,
// input, select, btn-*, badge-*) so the module looks native.
// ============================================================

/* ---------- Card ---------- */

interface SettingsCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon,
  action,
  children,
  className = '',
}) => (
  <div className={`card p-5 sm:p-6 ${className}`}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1] text-[#0d9488] flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {title && <h3 className="text-sm font-bold text-slate-900 font-display">{title}</h3>}
            {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    )}
    {children}
  </div>
);

/* ---------- Row ---------- */

interface SettingRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  stacked?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({ label, description, htmlFor, children, stacked = false }) => (
  <div
    className={`py-3.5 border-b border-slate-100 last:border-b-0 ${
      stacked ? 'space-y-2' : 'flex flex-col sm:flex-row sm:items-center justify-between gap-3'
    }`}
  >
    <div className={`min-w-0 sm:pr-6 ${stacked ? '' : 'sm:flex-1'}`}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800 cursor-default">
        {label}
      </label>
      {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div
      className={`flex-shrink-0 ${
        stacked ? 'w-full' : 'w-full sm:w-auto flex flex-col gap-1 sm:items-end'
      }`}
    >
      {children}
    </div>
  </div>
);

/* ---------- Toggle switch ---------- */

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false, id }) => (
  <span className="inline-flex items-center gap-2.5">
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[#0d9488] border-[#0d9488] cursor-pointer' : 'bg-slate-200 border-slate-200 cursor-pointer'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
    {label && <span className="text-xs font-medium text-slate-600 select-none">{label}</span>}
  </span>
);

/* ---------- Inline error ---------- */

export const FieldError: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  children ? (
    <p className="text-[11px] text-rose-600 mt-1 flex items-start gap-1 leading-snug">
      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  ) : null;

/* ---------- Chips ---------- */

export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}> = ({ children, color, active = false, onClick, title }) => {
  const base =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors select-none';
  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`${base} cursor-pointer ${
          active
            ? 'bg-[#0d9488] border-[#0d9488] text-white'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={base}
      style={
        color
          ? { backgroundColor: `${color}1a`, borderColor: `${color}55`, color }
          : { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#475569' }
      }
    >
      {children}
    </span>
  );
};

/* ---------- List row helpers ---------- */

export const ListRow: React.FC<{ children: React.ReactNode; dimmed?: boolean }> = ({ children, dimmed = false }) => (
  <div
    className={`flex items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white transition-opacity ${
      dimmed ? 'opacity-55' : ''
    }`}
  >
    {children}
  </div>
);

export const IconBtn: React.FC<{
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, disabled = false, danger = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    disabled={disabled}
    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      danger
        ? 'border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
        : 'border-slate-200 text-slate-400 hover:text-[#0d9488] hover:border-[#99f6e4] hover:bg-[#f0fdfa]'
    }`}
  >
    {children}
  </button>
);

/* ---------- Section footer (Save / Cancel / Reset) ---------- */

interface SectionFooterProps {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  saveLabel?: string;
  busy?: boolean;
}

export const SectionFooter: React.FC<SectionFooterProps> = ({
  dirty,
  saving = false,
  onSave,
  onCancel,
  onReset,
  saveLabel = 'Save Changes',
  busy = false,
}) => (
  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100">
    <button type="button" className="btn-ghost btn-sm text-slate-500" onClick={onReset}>
      <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
    </button>
    <div className="flex items-center gap-2.5">
      {dirty && (
        <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hidden sm:inline">
          Unsaved changes
        </span>
      )}
      <button type="button" className="btn-secondary btn-sm flex-1 sm:flex-none" onClick={onCancel} disabled={!dirty || busy}>
        <X className="w-3.5 h-3.5" /> Cancel
      </button>
      <button
        type="button"
        className="btn-primary btn-sm flex-1 sm:flex-none"
        onClick={onSave}
        disabled={!dirty || busy || saving}
      >
        {saving ? (
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {saveLabel}
      </button>
    </div>
  </div>
);

/* ---------- Section draft hook ---------- */

export interface SectionDraft<K extends SettingsSectionKey> {
  value: AdminSettings[K];
  dirty: boolean;
  patch: (updates: Partial<AdminSettings[K]>) => void;
  replace: (next: AdminSettings[K]) => void;
  cancel: () => void;
  /** Commits the staged value and returns it (call side effects after). */
  save: () => AdminSettings[K];
  reset: () => void;
}

export function useSectionDraft<K extends SettingsSectionKey>(key: K): SectionDraft<K> {
  const committed = useAdminSettingsStore((s) => s.settings[key]);
  const draft = useAdminSettingsStore((s) => s.drafts[key]);
  const setDraftSection = useAdminSettingsStore((s) => s.setDraftSection);
  const discardDraft = useAdminSettingsStore((s) => s.discardDraft);
  const updateSection = useAdminSettingsStore((s) => s.updateSection);
  const resetSection = useAdminSettingsStore((s) => s.resetSection);

  const value = (draft ?? committed) as AdminSettings[K];
  const dirty = draft !== undefined && JSON.stringify(draft) !== JSON.stringify(committed);

  return {
    value,
    dirty,
    patch: (updates) => setDraftSection(key, { ...value, ...updates } as AdminSettings[K]),
    replace: (next) => setDraftSection(key, next),
    cancel: () => discardDraft(key),
    save: () => {
      updateSection(key, value);
      return value;
    },
    reset: () => resetSection(key),
  };
}
