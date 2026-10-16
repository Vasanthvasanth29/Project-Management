import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Bell, Building2, CalendarRange, FolderKanban, ListChecks, Lock, RotateCcw, ScrollText, Settings2, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAdminSettingsStore, useOrganizationBranding, type SettingsSectionKey } from '../../store/adminSettingsStore';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { GeneralSection } from './settings/GeneralSection';
import { ProjectDefaultsSection } from './settings/ProjectDefaultsSection';
import { WorkItemsSection } from './settings/WorkItemsSection';
import { IterationsSection } from './settings/IterationsSection';
import { SecuritySection } from './settings/SecuritySection';
import { NotificationsSection } from './settings/NotificationsSection';
import { AuditSection } from './settings/AuditSection';

interface SectionMeta {
  key: SettingsSectionKey | 'audit';
  label: string;
  icon: React.ElementType;
  description: string;
}

const SECTIONS: SectionMeta[] = [
  {
    key: 'general',
    label: 'General',
    icon: Building2,
    description: 'Organization name, logo, time zone & schedule',
  },
  {
    key: 'projectDefaults',
    label: 'Project Defaults',
    icon: FolderKanban,
    description: 'Template, workflow, priority & issue types',
  },
  {
    key: 'workItems',
    label: 'Work Items',
    icon: ListChecks,
    description: 'Custom fields, statuses, priorities, labels',
  },
  {
    key: 'iterations',
    label: 'Iterations',
    icon: CalendarRange,
    description: 'Duration, naming pattern & rules',
  },
  {
    key: 'security',
    label: 'Security',
    icon: ShieldCheck,
    description: 'Session, login & permission policies',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Email, in-app, assignment & due dates',
  },
  {
    key: 'audit',
    label: 'Audit',
    icon: ScrollText,
    description: 'Activity, changes & log exports',
  },
];

const SECTIONS_WITH_DRAFTS = SECTIONS.filter((s) => s.key !== 'audit') as {
  key: SettingsSectionKey;
  label: string;
  icon: React.ElementType;
  description: string;
}[];

export const AdminSettingsPage: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const branding = useOrganizationBranding();
  const drafts = useAdminSettingsStore((s) => s.drafts);
  const resetAll = useAdminSettingsStore((s) => s.resetAll);

  const [activeKey, setActiveKey] = useState<SectionMeta['key']>('general');
  const [resetAllOpen, setResetAllOpen] = useState(false);

  if (!currentUser) return null;

  /* Defense in depth — the route is already ADMIN-gated. */
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="card p-8 max-w-lg mx-auto text-center space-y-3 animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Admin Settings is restricted</h1>
        <p className="text-sm text-slate-500">
          System-level organization settings are available to Administrators only.
        </p>
      </div>
    );
  }

  const unsavedSections = SECTIONS_WITH_DRAFTS.filter((s) => drafts[s.key] !== undefined);
  const activeMeta = SECTIONS.find((s) => s.key === activeKey)!;

  const renderSection = () => {
    switch (activeKey) {
      case 'general':
        return <GeneralSection />;
      case 'projectDefaults':
        return <ProjectDefaultsSection />;
      case 'workItems':
        return <WorkItemsSection />;
      case 'iterations':
        return <IterationsSection />;
      case 'security':
        return <SecuritySection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'audit':
      default:
        return <AuditSection />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="page-title inline-flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1] text-[#0d9488] flex items-center justify-center">
              <Settings2 className="w-5 h-5" />
            </span>
            Admin Settings
          </h1>
          <p className="page-subtitle">
            Organization-wide configuration for {branding.name} — General, Projects, Work Items, Iterations, Security,
            Notifications and Audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          {unsavedSections.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {unsavedSections.length} unsaved section{unsavedSections.length === 1 ? '' : 's'}
            </span>
          )}
          <button type="button" className="btn-ghost btn-sm text-slate-500" onClick={() => setResetAllOpen(true)}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset All
          </button>
        </div>
      </div>

      {/* Body: side nav + section content */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-5 items-start">
        {/* Settings navigation */}
        <nav
          className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0 lg:p-2 card"
          aria-label="Settings sections"
        >
          <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 pt-1 pb-2">
            Settings
          </span>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeKey === section.key;
            const hasDraft = section.key !== 'audit' && drafts[section.key as SettingsSectionKey] !== undefined;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveKey(section.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all shrink-0 lg:w-full ${
                  isActive
                    ? 'bg-[#0d9488] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent lg:border-slate-200 lg:bg-white'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold whitespace-nowrap">{section.label}</span>
                  <span
                    className={`hidden lg:block text-[10px] leading-tight mt-0.5 ${
                      isActive ? 'text-white/75' : 'text-slate-400'
                    }`}
                  >
                    {section.description}
                  </span>
                </span>
                {hasDraft && (
                  <span
                    className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-white' : 'bg-amber-500'
                    }`}
                    title="Unsaved changes"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div key={activeKey} className="min-w-0">
          <div className="flex items-center gap-2 mb-4 px-1">
            <activeMeta.icon className="w-4 h-4 text-[#0d9488]" />
            <h2 className="text-base font-bold text-slate-900 font-display">{activeMeta.label}</h2>
            <span className="text-xs text-slate-400 hidden sm:inline">— {activeMeta.description}</span>
          </div>
          {renderSection()}
          <p className="text-[11px] text-slate-400 mt-4 px-1">
            Frontend-only configuration — settings persist in this browser. The persistence layer can be swapped for a
            backend API later without any UI redesign.
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={resetAllOpen}
        onClose={() => setResetAllOpen(false)}
        onConfirm={() => {
          resetAll();
          setResetAllOpen(false);
          toast.success('All settings restored to factory defaults.');
        }}
        title="Reset all settings to default?"
        message="Every section (General, Project Defaults, Work Items, Iterations, Security, Notifications) will return to its factory default. The audit log is preserved."
        confirmLabel="Reset Everything"
        danger
      />
    </div>
  );
};
