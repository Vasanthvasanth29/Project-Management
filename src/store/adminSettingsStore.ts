import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Priority, WorkItemType } from '../types';
import { organization as initOrganization } from '../data/mockData';

// ============================================================
// FLOWEXEC ADMIN (ORGANIZATION) SETTINGS
// ------------------------------------------------------------
// Frontend-only configuration layer. Everything below lives in
// client state and is persisted to localStorage. No API calls,
// no fake services. When a backend arrives, swap the `persist`
// middleware for an API-backed adapter (load on hydrate, save on
// updateSection / appendAudit) without touching the UI: the page
// and its sections only ever talk to this store.
// ============================================================

export type SettingsSectionKey =
  | 'general'
  | 'projectDefaults'
  | 'workItems'
  | 'iterations'
  | 'security'
  | 'notifications';

export type AuditCategory = 'SETTINGS' | 'PERMISSION' | 'SECURITY' | 'EXPORT';

export interface GeneralSettings {
  organizationName: string;
  /** Remote URL or data URL. Empty string = use the default FlowExec brand tile. */
  logoUrl: string;
  /** IANA time zone id, e.g. "Asia/Kolkata". */
  timeZone: string;
  /** Working day codes: MON..SUN. At least one must stay selected. */
  workingDays: string[];
  /** 24h "HH:MM" start of the working window. */
  workingHoursStart: string;
  /** 24h "HH:MM" end of the working window. */
  workingHoursEnd: string;
}

export type ProjectTemplate = 'SCRUM' | 'KANBAN' | 'SIMPLIFIED' | 'WATERFALL' | 'CUSTOM';

export interface ProjectDefaultsSettings {
  template: ProjectTemplate;
  /** Default workflow name applied to newly created projects. */
  workflow: string;
  defaultPriority: Priority;
  /** Issue types pre-enabled for newly created projects. */
  issueTypes: WorkItemType[];
}

export type StatusCategory = 'BACKLOG' | 'ACTIVE' | 'REVIEW' | 'BLOCKED' | 'DONE';

export interface StatusDefinition {
  id: string;
  /** Stable machine key — built-in rows map onto the existing TaskStatus enum. */
  key: string;
  label: string;
  color: string;
  category: StatusCategory;
  enabled: boolean;
}

export interface PriorityDefinition {
  id: string;
  key: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  description: string;
}

export interface WorkItemsSettings {
  statuses: StatusDefinition[];
  priorities: PriorityDefinition[];
  labels: LabelDefinition[];
  components: ComponentDefinition[];
}

export interface IterationRules {
  /** Auto-number iterations from their parent PI (PI 30 → 30.1, 30.2 …). */
  autoNumber: boolean;
  /** Require a goal before an iteration can start. */
  requireGoal: boolean;
  /** Block starting an iteration while another is still active in the project. */
  preventOverlap: boolean;
  /** Schedule iteration dates on selected working days only. */
  workingDaysOnly: boolean;
  /** Carry incomplete work into the next iteration automatically. */
  autoCarryOver: boolean;
  /** Prevent further edits to completed iterations. */
  lockCompleted: boolean;
}

export interface IterationSettings {
  defaultDuration: number;
  durationUnit: 'DAYS' | 'WEEKS';
  rules: IterationRules;
}

export interface LoginPolicy {
  minPasswordLength: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  requireMfaForAdmins: boolean;
  allowPasswordLogin: boolean;
}

export interface PermissionPolicy {
  allowMemberProjectCreation: boolean;
  allowTlMemberManagement: boolean;
  restrictProfileEdits: boolean;
  allowExternalSharing: boolean;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  loginPolicy: LoginPolicy;
  permissionPolicy: PermissionPolicy;
  auditRetentionDays: number;
}

export type EmailDigest = 'INSTANT' | 'DAILY' | 'WEEKLY';

export interface NotificationSettings {
  emailEnabled: boolean;
  emailDigest: EmailDigest;
  inAppEnabled: boolean;
  inAppShowPreviews: boolean;
  notifyOnAssignment: boolean;
  assignmentEmailCopy: boolean;
  dueDateReminders: boolean;
  dueDateLeadDays: number;
  overdueAlerts: boolean;
  overdueEscalationDays: number;
}

export interface AdminSettings {
  general: GeneralSettings;
  projectDefaults: ProjectDefaultsSettings;
  workItems: WorkItemsSettings;
  iterations: IterationSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
}

export interface SettingsAuditEntry {
  id: string;
  createdAt: string;
  adminId: string;
  adminName: string;
  section: SettingsSectionKey | 'ALL';
  category: AuditCategory;
  /** Short action label, e.g. "Updated General settings". */
  action: string;
  /** Human-readable detail, e.g. the list of changed fields. */
  summary: string;
}

// ------------------------------------------------------------
// Reference option lists (UI constants)
// ------------------------------------------------------------

export const TIME_ZONE_OPTIONS: string[] = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export const WORKING_DAY_OPTIONS: { value: string; label: string; short: string }[] = [
  { value: 'MON', label: 'Monday', short: 'Mon' },
  { value: 'TUE', label: 'Tuesday', short: 'Tue' },
  { value: 'WED', label: 'Wednesday', short: 'Wed' },
  { value: 'THU', label: 'Thursday', short: 'Thu' },
  { value: 'FRI', label: 'Friday', short: 'Fri' },
  { value: 'SAT', label: 'Saturday', short: 'Sat' },
  { value: 'SUN', label: 'Sunday', short: 'Sun' },
];

export const TEMPLATE_OPTIONS: { value: ProjectTemplate; label: string; hint: string }[] = [
  { value: 'SCRUM', label: 'Scrum', hint: 'Iterations with backlog grooming and velocity tracking' },
  { value: 'KANBAN', label: 'Kanban', hint: 'Continuous flow with WIP limits' },
  { value: 'SIMPLIFIED', label: 'Simplified', hint: 'Lightweight board for small teams' },
  { value: 'WATERFALL', label: 'Waterfall', hint: 'Phase-gated delivery with milestones' },
  { value: 'CUSTOM', label: 'Custom', hint: 'No template — configure everything manually' },
];

export const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const ISSUE_TYPE_OPTIONS: { value: WorkItemType; label: string }[] = [
  { value: 'INITIATIVE', label: 'Initiative' },
  { value: 'FEATURE', label: 'Feature' },
  { value: 'EPIC', label: 'Epic' },
  { value: 'STORY', label: 'Story' },
  { value: 'TASK', label: 'Task' },
  { value: 'SUB-TASK', label: 'Sub-task' },
  { value: 'BUG_FIX', label: 'Bug' },
  { value: 'IMPROVEMENT', label: 'Improvement' },
];

export const STATUS_CATEGORY_OPTIONS: StatusCategory[] = ['BACKLOG', 'ACTIVE', 'REVIEW', 'BLOCKED', 'DONE'];

// ------------------------------------------------------------
// Defaults
// ------------------------------------------------------------

const detectTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const defaultStatuses: StatusDefinition[] = [
  { id: 'st-todo', key: 'TODO', label: 'To Do', color: '#64748b', category: 'BACKLOG', enabled: true },
  { id: 'st-inprogress', key: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', category: 'ACTIVE', enabled: true },
  { id: 'st-inreview', key: 'IN_REVIEW', label: 'In Review', color: '#8b5cf6', category: 'REVIEW', enabled: true },
  { id: 'st-testing', key: 'TESTING', label: 'Testing', color: '#f59e0b', category: 'REVIEW', enabled: true },
  { id: 'st-bugfix', key: 'BUG_FIX', label: 'Bug Fix', color: '#ef4444', category: 'ACTIVE', enabled: true },
  { id: 'st-retest', key: 'RETEST', label: 'Retest', color: '#f97316', category: 'REVIEW', enabled: true },
  { id: 'st-blocked', key: 'BLOCKED', label: 'Blocked', color: '#dc2626', category: 'BLOCKED', enabled: true },
  { id: 'st-done', key: 'DONE', label: 'Done', color: '#10b981', category: 'DONE', enabled: true },
  { id: 'st-cancelled', key: 'CANCELLED', label: 'Cancelled', color: '#94a3b8', category: 'DONE', enabled: false },
];

const defaultPriorities: PriorityDefinition[] = [
  { id: 'pr-low', key: 'LOW', label: 'Low', color: '#10b981', enabled: true },
  { id: 'pr-medium', key: 'MEDIUM', label: 'Medium', color: '#f59e0b', enabled: true },
  { id: 'pr-high', key: 'HIGH', label: 'High', color: '#f97316', enabled: true },
  { id: 'pr-critical', key: 'CRITICAL', label: 'Critical', color: '#ef4444', enabled: true },
];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  general: {
    organizationName: initOrganization.name,
    logoUrl: '',
    timeZone: detectTimeZone(),
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
  },
  projectDefaults: {
    template: 'SCRUM',
    workflow: 'Standard Delivery',
    defaultPriority: 'MEDIUM',
    issueTypes: ['EPIC', 'STORY', 'TASK', 'BUG_FIX', 'SUB-TASK'],
  },
  workItems: {
    statuses: defaultStatuses,
    priorities: defaultPriorities,
    labels: [
      { id: 'lbl-fast', name: 'fast-track', color: '#0d9488' },
      { id: 'lbl-tech', name: 'tech-debt', color: '#8b5cf6' },
      { id: 'lbl-cust', name: 'customer-request', color: '#f59e0b' },
    ],
    components: [
      { id: 'cmp-fe', name: 'Frontend', description: 'UI and client-side experience' },
      { id: 'cmp-be', name: 'Backend', description: 'APIs, services and server logic' },
      { id: 'cmp-db', name: 'Database', description: 'Schemas, migrations and data' },
      { id: 'cmp-docs', name: 'Documentation', description: 'Specs, guides and release notes' },
    ],
  },
  iterations: {
    defaultDuration: 2,
    durationUnit: 'WEEKS',
    rules: {
      autoNumber: true,
      requireGoal: true,
      preventOverlap: true,
      workingDaysOnly: true,
      autoCarryOver: false,
      lockCompleted: true,
    },
  },
  security: {
    sessionTimeoutMinutes: 120,
    loginPolicy: {
      minPasswordLength: 8,
      maxFailedAttempts: 5,
      lockoutMinutes: 15,
      requireMfaForAdmins: false,
      allowPasswordLogin: true,
    },
    permissionPolicy: {
      allowMemberProjectCreation: false,
      allowTlMemberManagement: true,
      restrictProfileEdits: true,
      allowExternalSharing: false,
    },
    auditRetentionDays: 180,
  },
  notifications: {
    emailEnabled: true,
    emailDigest: 'INSTANT',
    inAppEnabled: true,
    inAppShowPreviews: true,
    notifyOnAssignment: true,
    assignmentEmailCopy: true,
    dueDateReminders: true,
    dueDateLeadDays: 2,
    overdueAlerts: true,
    overdueEscalationDays: 1,
  },
};

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

export interface AdminSettingsState {
  settings: AdminSettings;
  /** Unsaved per-section edits. Session-only — never persisted. */
  drafts: Partial<AdminSettings>;
  auditLog: SettingsAuditEntry[];

  /** Commit a whole section (save). */
  updateSection: <K extends SettingsSectionKey>(key: K, value: AdminSettings[K]) => void;
  /** Stage edits for a section (draft — survives section switches). */
  setDraftSection: <K extends SettingsSectionKey>(key: K, value: AdminSettings[K]) => void;
  /** Drop staged edits for a section (cancel). */
  discardDraft: (key: SettingsSectionKey) => void;
  discardAllDrafts: () => void;
  /** Restore one section to factory defaults (immediate). */
  resetSection: (key: SettingsSectionKey) => void;
  /** Restore every section to factory defaults, keep the audit trail. */
  resetAll: () => void;
  /** Record an administrative audit event. */
  appendAudit: (entry: Omit<SettingsAuditEntry, 'id' | 'createdAt'>) => void;
}

const cloneDefaults = (): AdminSettings => JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS));

export const useAdminSettingsStore = create<AdminSettingsState>()(
  persist(
    (set) => ({
      settings: cloneDefaults(),
      drafts: {},
      auditLog: [],

      updateSection: (key, value) =>
        set((state) => {
          const nextDrafts = { ...state.drafts };
          delete nextDrafts[key];
          return {
            settings: { ...state.settings, [key]: value },
            drafts: nextDrafts,
          };
        }),

      setDraftSection: (key, value) =>
        set((state) => ({ drafts: { ...state.drafts, [key]: value } })),

      discardDraft: (key) =>
        set((state) => {
          const next = { ...state.drafts };
          delete next[key];
          return { drafts: next };
        }),

      discardAllDrafts: () => set({ drafts: {} }),

      resetSection: (key) =>
        set((state) => {
          const next = { ...state.drafts };
          delete next[key];
          return {
            settings: { ...state.settings, [key]: cloneDefaults()[key] },
            drafts: next,
          };
        }),

      resetAll: () => set((state) => ({ settings: cloneDefaults(), drafts: {} })),

      appendAudit: (entry) =>
        set((state) => ({
          auditLog: [
            {
              ...entry,
              id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              createdAt: new Date().toISOString(),
            },
            ...state.auditLog,
          ].slice(0, 500),
        })),
    }),
    {
      name: 'flowexec-admin-settings',
      // Drafts are intentionally session-only; only committed settings and the
      // audit trail survive a reload.
      partialize: (state) => ({ settings: state.settings, auditLog: state.auditLog }),
    }
  )
);

// ------------------------------------------------------------
// Branding selector — the single read path for org name / logo.
// Display surfaces (sidebar, topbar, dashboard) use this so the
// brand reflects Admin Settings immediately and across reloads.
// ------------------------------------------------------------

export const useOrganizationBranding = (): { name: string; logoUrl: string } => {
  const name = useAdminSettingsStore((s) => s.settings.general.organizationName);
  const logoUrl = useAdminSettingsStore((s) => s.settings.general.logoUrl);
  return { name: name || initOrganization.name, logoUrl };
};

/** Effective settings for a section: staged draft when present, otherwise committed. */
export const selectEffectiveSettings = <K extends SettingsSectionKey>(
  state: AdminSettingsState,
  key: K
): AdminSettings[K] => (state.drafts[key] as AdminSettings[K]) ?? state.settings[key];
