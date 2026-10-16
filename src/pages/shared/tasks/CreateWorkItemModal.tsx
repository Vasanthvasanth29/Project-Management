import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Layers,
  CornerDownRight,
  AlertCircle,
  Compass,
  Blocks,
  Sparkles,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { StoryTaskIcon } from '../../../components/common/StoryTaskIcon';
import { StoryIcon } from '../../../components/common/StoryIcon';
import { BugIssueIcon } from '../../../components/common/BugIssueIcon';
import type { Task, TaskStatus, Priority, WorkItemType } from '../../../types';
import {
  ROOT_CREATABLE_TYPES,
  getAllowedChildTypes,
  getAllowedParentTypes,
  getWorkItemLabel,
  getParentFieldLabel,
  isValidParentChild,
} from '../../../utils/workItemHierarchy';

interface CreateWorkItemModalProps {
  isOpen: boolean;
  projectId?: string;
  initialType?: WorkItemType;
  initialParentId?: string;
  onClose: () => void;
}

const TYPE_STYLES: Record<WorkItemType, { active: string; icon: React.ReactNode }> = {
  INITIATIVE: {
    active: 'border-[#b45309] bg-[#fffbeb] text-[#b45309] shadow-xs',
    icon: <Compass className="w-3.5 h-3.5" />,
  },
  FEATURE: {
    active: 'border-[#0d9488] bg-[#f0fdfa] text-[#0f766e] shadow-xs',
    icon: <Blocks className="w-3.5 h-3.5" />,
  },
  EPIC: {
    active: 'border-[#7c3aed] bg-[#f3e8ff] text-[#7c3aed] shadow-xs',
    icon: <Layers className="w-3.5 h-3.5" />,
  },
  STORY: {
    active: 'border-[#047857] bg-[#d1fae5] text-[#047857] shadow-xs',
    icon: <StoryIcon className="w-3.5 h-3.5" />,
  },
  TASK: {
    active: 'border-[#1a73e8] bg-[#e8f0fe] text-[#0b57d0] shadow-xs',
    icon: <StoryTaskIcon className="w-3.5 h-3.5" />,
  },
  BUG_FIX: {
    active: 'border-[#b91c1c] bg-[#fee2e2] text-[#b91c1c] shadow-xs',
    icon: <BugIssueIcon className="w-3.5 h-3.5" />,
  },
  IMPROVEMENT: {
    active: 'border-[#d97706] bg-[#fffbeb] text-[#b45309] shadow-xs',
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  'SUB-TASK': {
    active: 'border-[#0891b2] bg-[#ecfeff] text-[#0891b2] shadow-xs',
    icon: <CornerDownRight className="w-3.5 h-3.5" />,
  },
};

const TITLE_PLACEHOLDER: Record<WorkItemType, string> = {
  INITIATIVE: 'e.g. Support Services Portfolio',
  FEATURE: 'e.g. ET - IT Analytics Information Product',
  EPIC: 'e.g. Enable additional Incident data from SNOW',
  STORY: 'e.g. Parse assignment group from SNOW feed',
  TASK: 'e.g. Implement User Authentication',
  'SUB-TASK': 'e.g. Design Login Page',
  BUG_FIX: 'e.g. Fix cart total rounding error',
  IMPROVEMENT: 'e.g. Speed up catalogue search indexing',
};

export const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({
  isOpen,
  projectId,
  initialType = 'TASK',
  initialParentId = '',
  onClose,
}) => {
  const { tasks, projects, users, teams, createTask } = useAppStore();
  const { currentUser } = useAuthStore();

  const [type, setType] = useState<WorkItemType>(initialType);
  const [parentId, setParentId] = useState<string>(initialParentId);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projectId || (projects[0]?.id ?? '')
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [sprintId, setSprintId] = useState('');

  const lockedParent = initialParentId
    ? tasks.find((t) => t.id === initialParentId)
    : undefined;

  // Reset or initialize state when opened
  useEffect(() => {
    if (isOpen) {
      const parent = initialParentId ? tasks.find((t) => t.id === initialParentId) : undefined;
      const allowed = parent ? getAllowedChildTypes(parent.type) : ROOT_CREATABLE_TYPES;
      const resolvedType = allowed.includes(initialType) ? initialType : (allowed[0] ?? 'TASK');
      setType(resolvedType);
      setParentId(initialParentId);
      setSelectedProjectId(projectId || (projects[0]?.id ?? ''));
      setTitle('');
      setDescription('');
      setTeamId('');
      setAssigneeId('');
      setPriority('MEDIUM');
      setStatus('TODO');
      setDueDate(new Date().toISOString().split('T')[0]);
      setStartDate('');
      setSprintId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialType, initialParentId, projectId]);

  if (!isOpen) return null;

  const targetProjectId = projectId || selectedProjectId;
  const allowedTypes = lockedParent
    ? getAllowedChildTypes(lockedParent.type)
    : ROOT_CREATABLE_TYPES;

  const allowedParentTypes = getAllowedParentTypes(type);
  const availableParents = tasks.filter(
    (t) => t.projectId === targetProjectId && allowedParentTypes.includes(t.type)
  );

  const pickType = (nextType: WorkItemType) => {
    setType(nextType);
    if (lockedParent) return;
    // Keep the parent only when it is still valid for the new type
    const currentParent = tasks.find((t) => t.id === parentId);
    if (!currentParent || !isValidParentChild(currentParent.type, nextType)) {
      const firstParent = tasks.find(
        (t) => t.projectId === targetProjectId && getAllowedParentTypes(nextType).includes(t.type)
      );
      setParentId(nextType === 'SUB-TASK' && firstParent ? firstParent.id : '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!targetProjectId) {
      toast.error('Please select a project');
      return;
    }

    if (type === 'SUB-TASK' && !parentId) {
      toast.error('Please select a parent for this sub-task');
      return;
    }

    const parentTask = tasks.find((t) => t.id === parentId);
    if (parentTask && !isValidParentChild(parentTask.type, type)) {
      toast.error(`A ${getWorkItemLabel(type)} cannot be created under a ${getWorkItemLabel(parentTask.type)}`);
      return;
    }

    // An Initiative ALWAYS starts at BACKLOG in the Initiative workflow —
    // the form's generic status state is never trusted for INITIATIVE.
    const finalStatus = type === 'INITIATIVE' ? 'BACKLOG' : status;

    createTask({
      projectId: targetProjectId,
      parentId: parentId || undefined,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      priority,
      status: finalStatus,
      type,
      teamId: teamId || undefined,
      assigneeId: assigneeId || undefined,
      sprintId: sprintId || undefined,
      // Start Date belongs to the Initiative form only — other work-item types
      // keep their exact existing payload.
      ...(type === 'INITIATIVE' && startDate
        ? { startDate: new Date(startDate).toISOString() }
        : {}),
      createdById: currentUser?.id || 'admin',
    });

    toast.success(`${getWorkItemLabel(type)} "${title.trim()}" created successfully!`);
    onClose();
  };

  const parentFieldLabel = getParentFieldLabel(type);

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1f1f] font-display">Create Work Item</h3>
              <p className="text-xs text-[#747775]">
                {lockedParent
                  ? `New ${getWorkItemLabel(type)} under ${lockedParent.title}`
                  : 'Add an Initiative, Feature, Epic or Task to your project'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e0e2ec] text-[#747775] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Work Item Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Work Item Type <span className="text-[#d93025]">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allowedTypes.map((t) => {
                const style = TYPE_STYLES[t];
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`py-2 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      isActive ? style.active : 'border-[#e0e2ec] bg-[#f8fafd] text-[#444746] hover:bg-white'
                    }`}
                    onClick={() => pickType(t)}
                  >
                    {style.icon}
                    <span>{getWorkItemLabel(t)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Locked parent when created from a parent context */}
          {lockedParent && (
            <div className="space-y-1.5 animate-slide-in">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                {getParentFieldLabel(lockedParent.type)}
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f0fdfa] border border-[#99f6e4] text-xs font-semibold text-[#0f766e]">
                <span className="font-mono text-[10px] text-[#0d9488]">{getWorkItemLabel(lockedParent.type)}</span>
                <span className="truncate">{lockedParent.title}</span>
              </div>
            </div>
          )}

          {/* Project selector if not in a specific project */}
          {!projectId && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Project <span className="text-[#d93025]">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Parent selector (for hierarchy-aware types) */}
          {!lockedParent && allowedParentTypes.length > 0 && (
            <div className="space-y-1.5 animate-slide-in">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider flex items-center justify-between">
                <span>
                  {parentFieldLabel}{' '}
                  {type === 'SUB-TASK' && <span className="text-[#d93025]">*</span>}
                </span>
                <span className="text-[10px] text-[#747775] font-normal">
                  {type === 'SUB-TASK' ? 'Required' : 'Optional'}
                </span>
              </label>
              {availableParents.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#fce8e6] text-[#d93025] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    No {allowedParentTypes.map(getWorkItemLabel).join(' / ')} available in this project yet.
                  </span>
                </div>
              ) : (
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="">
                    {type === 'SUB-TASK' ? `-- Select Parent --` : `No ${parentFieldLabel} (Standalone)`}
                  </option>
                  {availableParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getWorkItemLabel(p.type)}: {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              {type === 'INITIATIVE' ? 'Initiative Name' : `${getWorkItemLabel(type)} Title`}{' '}
              <span className="text-[#d93025]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={TITLE_PLACEHOLDER[type]}
              className="w-full px-3 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-sm font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed acceptance criteria or summary..."
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] resize-none"
            />
          </div>

          {/* Team */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Responsible Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
            >
              <option value="">No team assigned</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>

          {type === 'INITIATIVE' ? (
            /* ------------------------------------------------------------
             * Initiative form (Jira Advanced Roadmaps style): independent
             * from the generic Task form — no parent selector, no sprint,
             * Start Date + Target/Due Date, and a permanently locked
             * Backlog status. Everything else stays on the shared fields.
             * ------------------------------------------------------------ */
            <>
              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date & Target / Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Target / Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              {/* Priority & Status (locked) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Status</label>
                  {/* Initiatives always enter the Initiative workflow at Backlog:
                      the status is locked for creation, never selectable. */}
                  <div className="relative">
                    <select
                      value="BACKLOG"
                      disabled
                      aria-label="Status"
                      className="w-full px-3 py-2 pr-8 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] opacity-60 cursor-not-allowed appearance-none"
                    >
                      <option value="BACKLOG">Backlog</option>
                    </select>
                    <Lock className="w-3.5 h-3.5 text-[#9aa0a6] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Due Date & Priority Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              {/* Assignee & Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="TESTING">Testing</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#f1f3f4] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e0e2ec] hover:bg-[#f0f4f9] text-xs font-semibold text-[#444746] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || (type === 'SUB-TASK' && !parentId)}
              className="px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#0b57d0] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create {getWorkItemLabel(type)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
