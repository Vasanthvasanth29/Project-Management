import React, { useState } from 'react';
import { toast } from 'sonner';
import { FolderKanban, GitBranch, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  TEMPLATE_OPTIONS,
  useAdminSettingsStore,
} from '../../../store/adminSettingsStore';
import { FieldError, SectionFooter, SettingsCard, SettingRow, useSectionDraft } from './sectionUi';

export const ProjectDefaultsSection: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const priorities = useAdminSettingsStore((s) => s.settings.workItems.priorities);
  const { value, dirty, patch, cancel, save, reset } = useSectionDraft('projectDefaults');

  const [errors, setErrors] = useState<{ workflow?: string; issueTypes?: string; defaultPriority?: string }>({});
  const [saving, setSaving] = useState(false);

  const priorityOptions = (() => {
    const enabled = priorities.filter((p) => p.enabled).map((p) => p.key) as typeof PRIORITY_OPTIONS;
    return enabled.length > 0 ? enabled : PRIORITY_OPTIONS;
  })();

  const toggleIssueType = (type: (typeof ISSUE_TYPE_OPTIONS)[number]['value']) => {
    const next = value.issueTypes.includes(type)
      ? value.issueTypes.filter((t) => t !== type)
      : [...value.issueTypes, type];
    patch({ issueTypes: next });
    setErrors((e) => ({ ...e, issueTypes: undefined }));
  };

  const handleSave = () => {
    const errs: { workflow?: string; issueTypes?: string; defaultPriority?: string } = {};
    if (!value.workflow.trim()) errs.workflow = 'Default workflow name is required.';
    else if (value.workflow.trim().length > 60) errs.workflow = 'Keep the workflow name under 60 characters.';
    if (value.issueTypes.length === 0) errs.issueTypes = 'Select at least one default issue type.';
    if (!priorityOptions.includes(value.defaultPriority)) errs.defaultPriority = 'Choose an enabled priority.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    const next = save();
    appendAudit({
      adminId: currentUser?.id || 'admin',
      adminName: currentUser?.name || 'Administrator',
      section: 'projectDefaults',
      category: 'SETTINGS',
      action: 'Updated Project Defaults',
      summary: `${TEMPLATE_OPTIONS.find((t) => t.value === next.template)?.label || next.template} template · ${next.workflow} workflow · ${next.defaultPriority} priority · ${next.issueTypes.length} issue types`,
    });
    setTimeout(() => {
      setSaving(false);
      toast.success('Project defaults saved — new projects will use them automatically.');
    }, 200);
  };

  const templateHint = TEMPLATE_OPTIONS.find((t) => t.value === value.template)?.hint;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="New Project Defaults"
        description="Pre-filled in the Create Project dialog. Admins can still override any value per project."
        icon={<FolderKanban className="w-4 h-4" />}
      >
        <SettingRow
          label="Default Project Template"
          description={templateHint}
          htmlFor="pd-template"
        >
          <div className="w-full sm:w-72">
            <select
              id="pd-template"
              className="select text-sm"
              value={value.template}
              onChange={(e) => patch({ template: e.target.value as typeof value.template })}
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </SettingRow>

        <SettingRow
          label={
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-slate-400" /> Default Workflow
            </span>
          }
          description="Workflow applied to new projects; refine stages later in the Workflow Builder."
          htmlFor="pd-workflow"
        >
          <div className="w-full sm:w-72">
            <input
              id="pd-workflow"
              type="text"
              className={`input text-sm ${errors.workflow ? 'border-rose-400 focus:ring-rose-500' : ''}`}
              value={value.workflow}
              placeholder="e.g. Standard Delivery"
              onChange={(e) => {
                patch({ workflow: e.target.value });
                setErrors((er) => ({ ...er, workflow: undefined }));
              }}
            />
            <FieldError>{errors.workflow}</FieldError>
          </div>
        </SettingRow>

        <SettingRow
          label="Default Priority"
          description="Initial priority for work items created in new projects."
          htmlFor="pd-priority"
        >
          <div className="w-full sm:w-72">
            <select
              id="pd-priority"
              className={`select text-sm ${errors.defaultPriority ? 'border-rose-400' : ''}`}
              value={value.defaultPriority}
              onChange={(e) => {
                patch({ defaultPriority: e.target.value as typeof value.defaultPriority });
                setErrors((er) => ({ ...er, defaultPriority: undefined }));
              }}
            >
              {priorityOptions.map((p) => {
                const def = priorities.find((pr) => pr.key === p);
                return (
                  <option key={p} value={p}>
                    {def?.label || p}
                  </option>
                );
              })}
            </select>
            <FieldError>{errors.defaultPriority}</FieldError>
          </div>
        </SettingRow>

        <SettingRow label="Default Issue Types" description="Issue types enabled for new projects." stacked>
          <div className="flex items-center gap-2 flex-wrap">
            {ISSUE_TYPE_OPTIONS.map((t) => {
              const active = value.issueTypes.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleIssueType(t.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-[#0d9488] border-[#0d9488] text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <FieldError>{errors.issueTypes}</FieldError>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        className="bg-[#f0fdfa]/60 border-[#ccfbf1]"
        icon={<Sparkles className="w-4 h-4" />}
        title="How these defaults are used"
        description="The Create Project dialog shows a “Organization Defaults” summary and applies these values to every new project unless the admin opts out for that project."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Template', value: TEMPLATE_OPTIONS.find((t) => t.value === value.template)?.label || value.template },
            { label: 'Workflow', value: value.workflow || '—' },
            { label: 'Priority', value: priorities.find((p) => p.key === value.defaultPriority)?.label || value.defaultPriority },
            { label: 'Issue Types', value: `${value.issueTypes.length} selected` },
          ].map((s) => (
            <div key={s.label} className="px-3 py-2.5 rounded-xl bg-white border border-[#ccfbf1]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-600">{s.label}</div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5 truncate" title={s.value}>{s.value}</div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SectionFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => {
          cancel();
          setErrors({});
        }}
        onReset={() => {
          reset();
          setErrors({});
          toast.success('Project defaults reset.');
        }}
      />
    </div>
  );
};
