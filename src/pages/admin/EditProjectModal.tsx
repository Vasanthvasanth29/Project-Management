import React, { useMemo, useState } from 'react';
import { X, FolderKanban, Calendar, Tag, Save, Sparkles, KeyRound, Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { SearchableUserSelect } from '../../components/common/SearchableUserSelect';
import { canManageProjectSettings } from '../../utils/roleUtils';
import {
  getIssueKeyPrefix,
  normalizeProjectName,
  sanitizeProjectKey,
  validateProjectKey,
  validateProjectName,
} from '../../utils/projectIdentity';
import { toast } from 'sonner';
import type { Project, ProjectStatus } from '../../types';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/**
 * Project Settings — the ONE editor for a project's identity (name, key,
 * derived issue prefix) and its basic configuration. The key drives every
 * derived reference (issue keys `WEBCORM-500`, iteration ids `WEBCORM4.1`),
 * so saving re-issues them store-wide via `updateProject`. ADMIN and
 * Project Manager only, mirroring the finalized permission matrix.
 */
export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose }) => {
  const { updateProject, users, projects } = useAppStore();
  const { currentUser } = useAuthStore();

  const [form, setForm] = useState({
    name: project.name,
    key: (project.key || '').toUpperCase(),
    description: project.description,
    status: project.status,
    type: project.type,
    startDate: project.startDate,
    targetDate: project.targetDate,
    projectManagerId: project.projectManagerId,
  });
  const [loading, setLoading] = useState(false);

  const allowed = canManageProjectSettings(currentUser?.role);

  // Derived, read-only identity preview — never typed, never stored separately.
  const derivedPrefix = useMemo(() => getIssueKeyPrefix({ key: form.key }), [form.key]);
  const keyValidation = useMemo(
    () => validateProjectKey(form.key, projects, project.id),
    [form.key, projects, project.id]
  );
  const nameValidation = useMemo(
    () => validateProjectName(form.name, projects, project.id),
    [form.name, projects, project.id]
  );
  const keyDirty = form.key.trim().toUpperCase() !== (project.key || '').toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowed) {
      toast.error('Only admins and Project Managers can edit project settings');
      return;
    }
    if (!nameValidation.ok) {
      toast.error(nameValidation.error || 'Invalid Project Name');
      return;
    }
    if (keyDirty && !keyValidation.ok) {
      toast.error(keyValidation.error || 'Invalid Project Key');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    updateProject(
      project.id,
      {
        name: normalizeProjectName(form.name),
        key: form.key.trim().toUpperCase(),
        description: form.description.trim(),
        status: form.status,
        type: form.type,
        startDate: form.startDate,
        targetDate: form.targetDate,
        projectManagerId: form.projectManagerId,
      },
      currentUser?.id
    );

    const pm = users.find((u) => u.id === form.projectManagerId);
    const prefix = getIssueKeyPrefix({ key: form.key });
    toast.success(
      `Project Settings saved · issues now keyed ${prefix}-# · iterations ${prefix}4.1${pm ? ` · PM ${pm.name}` : ''}`
    );
    setLoading(false);
    onClose();
  };

  if (!allowed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-modal animate-scale-in p-6 text-center">
          <div className="mx-auto w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-900">Project Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Only admins and Project Managers can edit a project's identity and settings.
          </p>
          <button type="button" className="btn-secondary w-full mt-5" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-modal animate-scale-in max-h-[92vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Project Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {project.key ? `[${project.key}] ` : ''}
                {project.name} — identity &amp; configuration
              </p>
            </div>
          </div>
          <button className="btn-ghost p-2 rounded-xl text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* PROJECT DETAILS — identity */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase">Project Details</h3>
            </div>

            <div>
              <label className="input-label" htmlFor="ep-name">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="ep-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`input ${!nameValidation.ok ? 'border-rose-400 focus:ring-rose-500' : ''}`}
                aria-invalid={!nameValidation.ok}
                required
              />
              {!nameValidation.ok && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {nameValidation.error}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label" htmlFor="ep-key">
                  Project Key <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="ep-key"
                    type="text"
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: sanitizeProjectKey(e.target.value) })}
                    className={`input pl-9 uppercase font-mono tracking-wider font-semibold ${
                      keyDirty && !keyValidation.ok ? 'border-rose-400 focus:ring-rose-500' : ''
                    }`}
                    maxLength={14}
                    aria-invalid={keyDirty && !keyValidation.ok}
                  />
                </div>
                {keyDirty && !keyValidation.ok ? (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {keyValidation.error}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Unique per project, e.g. WEBCORM4.0 (version suffix optional)
                  </p>
                )}
              </div>

              <div>
                <label className="input-label" htmlFor="ep-prefix">
                  Issue Prefix <span className="text-slate-400 font-normal">(derived)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="ep-prefix"
                    type="text"
                    value={derivedPrefix}
                    readOnly
                    className="input pl-9 bg-slate-50 text-slate-600 font-mono tracking-wider cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Issues {derivedPrefix || 'KEY'}-500 · Iterations {derivedPrefix || 'KEY'}4.1
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label" htmlFor="ep-id">
                  Project ID <span className="text-slate-400 font-normal">(immutable)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="ep-id"
                    type="text"
                    value={project.id}
                    readOnly
                    className="input pl-9 bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Never changes — internal references stay intact</p>
              </div>
              <div>
                <label className="input-label" htmlFor="ep-status">
                  Status
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="ep-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    className="select pl-9"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="input-label" htmlFor="ep-desc">
              Description
            </label>
            <textarea
              id="ep-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project overview and deliverables..."
              className="input resize-none h-20"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label" htmlFor="ep-start">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="ep-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="input pl-9"
                />
              </div>
            </div>
            <div>
              <label className="input-label" htmlFor="ep-end">
                Target Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="ep-end"
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                  className="input pl-9"
                />
              </div>
            </div>
          </div>

          {/* Project Manager */}
          <div>
            <label className="input-label">Project Manager</label>
            <p className="text-xs text-slate-400 mb-2">Reassign the project to any active Project Manager</p>
            <SearchableUserSelect
              users={users}
              value={form.projectManagerId}
              onChange={(id) => setForm({ ...form, projectManagerId: id })}
              placeholder="Search Project Manager by name or ID..."
              filterRole={['PROJECT_MANAGER']}
            />
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900 leading-relaxed">
              Changes apply immediately for every member, team and Project Manager working on this project.
              {keyDirty && keyValidation.ok
                ? ` Renaming the key re-issues issue keys and iteration IDs to ${derivedPrefix}-# / ${derivedPrefix}4.1 — issue numbers, titles and relationships stay unchanged.`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center gap-2" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
