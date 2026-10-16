import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity, Download, FileJson, FolderKanban, History, RefreshCw, ScrollText, Search, ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { useAdminSettingsStore, type SettingsSectionKey } from '../../../store/adminSettingsStore';
import { SettingsCard } from './sectionUi';
import { downloadTextFile, formatDisplayTime, formatTimestamp, timestampSlug, toCSV, type ExportRow } from './auditExport';

type TabKey = 'ACTIVITY' | 'PERMISSIONS' | 'PROJECTS' | 'EXPORTS';

interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  source: 'App Activity' | 'Admin Settings';
}

interface TabMeta {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabMeta[] = [
  { key: 'ACTIVITY', label: 'User Activity', icon: Activity, description: 'Sign-ins, record changes and administrative actions across the organization.' },
  { key: 'PERMISSIONS', label: 'Permission Changes', icon: ShieldCheck, description: 'Role, policy and security-related changes.' },
  { key: 'PROJECTS', label: 'Project Changes', icon: FolderKanban, description: 'Project lifecycle events and default configuration changes.' },
  { key: 'EXPORTS', label: 'Export Logs', icon: Download, description: 'History of audit exports generated from this page.' },
];

const PERMISSION_KEYWORDS = ['role', 'permission', 'policy', 'mfa', 'lockout', 'password', 'signed in', 'provisioned', 'security'];

type DatePreset = 'ALL' | 'TODAY' | '7D' | '30D';
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 days' },
  { value: '30D', label: 'Last 30 days' },
];

const withinPreset = (iso: string, preset: DatePreset): boolean => {
  if (preset === 'ALL') return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (preset === 'TODAY') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = preset === '7D' ? 7 : 30;
  return t >= now - days * 24 * 60 * 60 * 1000;
};

const SECTION_LABELS: Record<SettingsSectionKey, string> = {
  general: 'General',
  projectDefaults: 'Project Defaults',
  workItems: 'Work Items',
  iterations: 'Iterations',
  security: 'Security',
  notifications: 'Notifications',
};

const ROW_LIMIT = 150;

export const AuditSection: React.FC = () => {
  const activities = useAppStore((s) => s.activities);
  const users = useAppStore((s) => s.users);
  const projects = useAppStore((s) => s.projects);
  const auditLog = useAdminSettingsStore((s) => s.auditLog);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const retentionDays = useAdminSettingsStore((s) => s.settings.security.auditRetentionDays);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [tab, setTab] = useState<TabKey>('ACTIVITY');
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');

  const actorName = (userId: string): string => {
    if (userId === 'automation') return 'Automation';
    return users.find((u) => u.id === userId)?.name || userId;
  };

  const allRows = useMemo<AuditRow[]>(() => {
    const fromActivities: AuditRow[] = activities.map((a) => {
      const project = a.projectId ? projects.find((p) => p.id === a.projectId) : undefined;
      return {
        id: `act-${a.id}`,
        at: a.createdAt,
        actor: actorName(a.userId),
        action: a.action,
        detail: `${a.entityType}${project ? ` · ${project.name}` : ''} — ${a.entityTitle}`,
        source: 'App Activity',
      };
    });

    const fromSettings: AuditRow[] = auditLog.map((e) => ({
      id: e.id,
      at: e.createdAt,
      actor: e.adminName,
      action: e.action,
      detail: `${SECTION_LABELS[e.section as SettingsSectionKey] || 'Organization'} — ${e.summary} [${e.category}]`,
      source: 'Admin Settings',
    }));

    return [...fromActivities, ...fromSettings].sort((a, b) => b.at.localeCompare(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, auditLog, users, projects]);

  const tabRows = useMemo<AuditRow[]>(() => {
    switch (tab) {
      case 'PERMISSIONS':
        return allRows.filter((r) =>
          r.source === 'Admin Settings'
            ? r.detail.includes('[PERMISSION]') || r.detail.includes('[SECURITY]')
            : PERMISSION_KEYWORDS.some((k) => r.action.toLowerCase().includes(k))
        );
      case 'PROJECTS':
        return allRows.filter((r) =>
          r.source === 'Admin Settings'
            ? r.detail.startsWith('Project Defaults')
            : r.action.includes('project') || r.detail.startsWith('PROJECT')
        );
      case 'EXPORTS':
        return allRows.filter((r) => r.source === 'Admin Settings' && r.detail.includes('[EXPORT]'));
      default:
        return allRows;
    }
  }, [allRows, tab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabRows.filter((r) => {
      if (!withinPreset(r.at, datePreset)) return false;
      if (userFilter && r.actor !== userFilter) return false;
      if (q && !`${r.actor} ${r.action} ${r.detail}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tabRows, search, userFilter, datePreset]);

  const visibleRows = filteredRows.slice(0, ROW_LIMIT);

  const exportRows = (rows: AuditRow[]): ExportRow[] =>
    rows.map((r) => ({
      timestamp: formatTimestamp(r.at),
      actor: r.actor,
      action: r.action,
      detail: r.detail,
      source: r.source,
    }));

  const logExport = (scope: string, format: string, count: number) => {
    appendAudit({
      adminId: currentUser?.id || 'admin',
      adminName: currentUser?.name || 'Administrator',
      section: 'ALL',
      category: 'EXPORT',
      action: `Exported ${scope}`,
      summary: `${format} · ${count} row${count === 1 ? '' : 's'}`,
    });
  };

  const handleExport = (format: 'CSV' | 'JSON') => {
    if (filteredRows.length === 0) {
      toast.error('Nothing to export with the current filters.');
      return;
    }
    const rows = exportRows(filteredRows);
    const scope = TABS.find((t) => t.key === tab)?.label || 'audit';
    if (format === 'CSV') {
      downloadTextFile(`flowexec-audit-${tab.toLowerCase()}-${timestampSlug()}.csv`, toCSV(rows), 'text/csv');
    } else {
      downloadTextFile(
        `flowexec-audit-${tab.toLowerCase()}-${timestampSlug()}.json`,
        JSON.stringify(rows, null, 2),
        'application/json'
      );
    }
    logExport(scope, format, rows.length);
    toast.success(`${scope} exported as ${format} (${rows.length} rows).`);
  };

  const handleExportEverything = () => {
    const rows = exportRows(allRows);
    if (rows.length === 0) {
      toast.error('There are no audit records to export yet.');
      return;
    }
    downloadTextFile(`flowexec-full-audit-${timestampSlug()}.csv`, toCSV(rows), 'text/csv');
    logExport('Full audit trail', 'CSV', rows.length);
    toast.success(`Full audit trail exported (${rows.length} rows).`);
  };

  const actorOptions = useMemo(() => {
    const names = new Set<string>();
    tabRows.forEach((r) => names.add(r.actor));
    return Array.from(names).sort();
  }, [tabRows]);

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Audit"
        description={`Structured audit interface — retention is ${retentionDays} days (configured in Security).`}
        icon={<ScrollText className="w-4 h-4" />}
        action={
          <button type="button" className="btn-secondary btn-sm" onClick={handleExportEverything}>
            <Download className="w-3.5 h-3.5 text-[#0d9488]" /> Export All
          </button>
        }
      >
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-thin mb-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0d9488]' : 'text-slate-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 mb-4">{activeTab.description}</p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
          <div className="search-pill flex-1">
            <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent text-sm focus:outline-none"
              placeholder="Search actor, action or detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select text-sm sm:w-44"
            value={userFilter}
            aria-label="Filter by actor"
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="">All actors</option>
            {actorOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="select text-sm sm:w-36"
            value={datePreset}
            aria-label="Filter by date"
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost btn-sm text-slate-500"
            title="Reset filters"
            onClick={() => {
              setSearch('');
              setUserFilter('');
              setDatePreset('ALL');
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => handleExport('CSV')}>
            <Download className="w-3.5 h-3.5 text-[#0d9488]" /> CSV
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => handleExport('JSON')}>
            <FileJson className="w-3.5 h-3.5 text-[#0d9488]" /> JSON
          </button>
        </div>

        {/* Result meta */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
          <span>
            {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
            {filteredRows.length > ROW_LIMIT ? ` · showing first ${ROW_LIMIT}` : ''}
          </span>
          <span className="inline-flex items-center gap-1">
            <History className="w-3 h-3" /> Newest first
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-[150px_150px_1fr_1.3fr] gap-3 px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Time</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Detail</span>
          </div>

          {visibleRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <ScrollText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">No audit records match these filters.</p>
              <p className="text-[11px] text-slate-400 mt-1">Try clearing the search or changing the date range.</p>
            </div>
          ) : (
            visibleRows.map((row) => (
              <div
                key={row.id}
                className="md:grid md:grid-cols-[150px_150px_1fr_1.3fr] gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors"
              >
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5 md:block">
                  {formatDisplayTime(row.at)}
                  <span
                    className={`md:hidden badge text-[9px] ${
                      row.source === 'Admin Settings' ? 'badge-teal' : 'badge-gray'
                    }`}
                  >
                    {row.source === 'Admin Settings' ? 'Settings' : 'Activity'}
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-700 truncate block">{row.actor}</span>
                <span className="text-xs text-slate-800 flex items-center gap-2 flex-wrap">
                  {row.action}
                  <span
                    className={`hidden md:inline badge text-[9px] ${
                      row.source === 'Admin Settings' ? 'badge-teal' : 'badge-gray'
                    }`}
                  >
                    {row.source}
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 block truncate" title={row.detail}>
                  {row.detail}
                </span>
              </div>
            ))
          )}
        </div>
      </SettingsCard>
    </div>
  );
};
