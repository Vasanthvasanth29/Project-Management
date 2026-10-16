import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRight,
  FolderKanban,
  Layers,
  Zap,
  CheckCircle2,
  FolderInput,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { TaskTypeBadge } from './TaskTypeBadge';
import { StatusBadge } from '../../../components/common/Badges';
import { getStatusLabel } from '../../../utils/roleUtils';
import { piNumberForSprint } from '../../../utils/programIncrement';
import { usePiPlan, resolveDefaultSprintId } from '../../../data/piSprintStructure';
import type { PlanPi, PlanSprint } from '../../../data/piSprintStructure';
import { resolveIssueKey } from '../../../utils/issueKeyResolver';
import type { Task, TaskStatus } from '../../../types';
import {
  getAllowedChildTypes,
  getAllowedParentTypes,
  getWorkItemLabel,
  getParentFieldLabel,
  isValidParentChild,
} from '../../../utils/workItemHierarchy';

/** Board statuses the Move form offers for non-Initiative types. */
const GENERIC_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

/**
 * A status safe to keep when a work item stops being an Initiative: Done maps
 * to Done, every other workflow stage falls back to To Do, so the card always
 * lands on a real board column.
 */
const toGenericStatus = (status: TaskStatus): TaskStatus => {
  if (status === 'DONE' || status === 'COMPLETED') return 'DONE';
  return (GENERIC_STATUSES as string[]).includes(status) ? (status as TaskStatus) : 'TODO';
};

interface MoveTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MoveTaskModal: React.FC<MoveTaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onSuccess,
}) => {
  const { tasks, projects, sprints, pis, moveTask } = useAppStore();
  const { currentUser } = useAuthStore();

  const [targetParentId, setTargetParentId] = useState<string>('NONE');
  const [targetSprintId, setTargetSprintId] = useState<string>('BACKLOG');
  const [targetStatus, setTargetStatus] = useState<TaskStatus>('TODO');
  const [targetType, setTargetType] = useState<Task['type']>('TASK');
  // Two-step flow: form → confirmation. The move only applies on confirm.
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  // Destination Project is the project the action was opened from — fixed
  // for this workflow (never an editable dropdown).
  const targetProjectId = task?.projectId || '';

  useEffect(() => {
    if (task && isOpen) {
      // Defaults from the item itself and the centralized PI → Sprint plan:
      // its own project/parent/status/type, and its own sprint when it has
      // one (an item in 4.1 keeps 4.1 selected); Work Queue only when the
      // item genuinely has no iteration.
      setTargetParentId(task.parentId || 'NONE');
      setTargetSprintId(resolveDefaultSprintId(sprints, task.projectId || '', task.sprintId));
      setTargetStatus(toGenericStatus(task.status || 'TODO'));
      setTargetType(task.type || 'TASK');
      setStep('form');
    }
  }, [task, isOpen, sprints]);

  // Current parent info
  const currentParent = useMemo(() => {
    return tasks.find((t) => t.id === task?.parentId);
  }, [tasks, task]);

  // Candidate parents in the project (excluding the item itself and its
  // descendants to avoid loops). Filtered by type at the point of use.
  const parentCandidates = useMemo(() => {
    if (!targetProjectId || !task) return [] as Task[];

    // Disallow self and direct descendants to avoid loops
    const disallowedIds = new Set<string>([task.id]);
    let added = true;
    while (added) {
      added = false;
      tasks.forEach((t) => {
        if (t.parentId && disallowedIds.has(t.parentId) && !disallowedIds.has(t.id)) {
          disallowedIds.add(t.id);
          added = true;
        }
      });
    }

    return tasks.filter(
      (t) => t.projectId === targetProjectId && !disallowedIds.has(t.id)
    );
  }, [tasks, targetProjectId, task]);

  // The centralized PI → Sprint plan — the same source the Iteration
  // Overview renders, so both surfaces always agree.
  const piPlan = usePiPlan(targetProjectId);

  // Flat sprint lookup for the confirm / location summaries.
  const planSprintById = useMemo(() => {
    const map = new Map<string, PlanSprint>();
    piPlan.forEach((pi) => pi.sprints.forEach((s) => map.set(s.id, s)));
    return map;
  }, [piPlan]);

  // Dropdown destinations: one continuous chronological list of the plan's
  // active + planned sprints — no ACTIVE/PLANNED heading rows. The item's own
  // sprint is always kept selectable — even when completed — so the default
  // selection matches its real location and confirming without edits is a
  // no-op, never a silent move. The currently running sprint is marked with a
  // green dot derived from its real status, never a hardcoded sprint number.
  const destinationSprints = useMemo(() => {
    const ownId = task?.sprintId;
    const entries = piPlan.flatMap((pi: PlanPi) =>
      pi.sprints.filter(
        (s) => s.status === 'ACTIVE' || s.status === 'PLANNED' || s.id === ownId
      )
    );
    // De-duplicate and order chronologically by start date (ISO dates compare
    // correctly as strings), so the list reads 4.3 → 4.4 → … → 5.1 → 5.2.
    const unique = Array.from(new Map(entries.map((s) => [s.id, s])).values());
    return unique.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [piPlan, task]);

  const targetProject = useMemo(
    () => projects.find((p) => p.id === targetProjectId),
    [projects, targetProjectId]
  );

  if (!isOpen || !task) return null;

  // Initiatives keep their workflow status through a move, and converting any
  // item into an Initiative always lands it at Backlog. Either way the status
  // select is presentation-only: the store gates re-validate every applied
  // change against the centralised Initiative workflow rules.
  const isInitiative = task.type === 'INITIATIVE';
  const willBeInitiative = targetType === 'INITIATIVE';
  const statusLocked = isInitiative || willBeInitiative;
  const nextStatus: TaskStatus = isInitiative
    ? task.status
    : willBeInitiative
      ? 'BACKLOG'
      : targetStatus;

  // Confirmation-state display values.
  const sourceProject = projects.find((p) => p.id === task.projectId);
  const workItemKey = resolveIssueKey(sourceProject, task);

  // "Project → PI n → Iteration" (or "Project → Work Queue") for the confirm
  // step, and "PI n → Iteration" / "Work Queue" for the live location summary
  // — every PI number resolved from the plan, never hardcoded.
  const iterationPath = (
    projectName: string | undefined,
    sprintIdValue: string | undefined,
    emptyLabel: string
  ): string => {
    const planSprint = sprintIdValue ? planSprintById.get(sprintIdValue) : undefined;
    if (!planSprint) return `${projectName || '—'} → ${emptyLabel}`;
    const sprint = sprints.find((s) => s.id === sprintIdValue);
    const number = sprint ? piNumberForSprint(sprint, pis) : undefined;
    return `${projectName || '—'}${number !== undefined ? ` → PI ${number}` : ''} → ${planSprint.displayName}`;
  };

  const iterationLocation = (sprintIdValue: string | undefined, emptyLabel: string): string => {
    const planSprint = sprintIdValue ? planSprintById.get(sprintIdValue) : undefined;
    if (!planSprint) return emptyLabel;
    const sprint = sprints.find((s) => s.id === sprintIdValue);
    const number = sprint ? piNumberForSprint(sprint, pis) : undefined;
    return number !== undefined ? `PI ${number} → ${planSprint.displayName}` : planSprint.displayName;
  };

  const allowedParentTypes = getAllowedParentTypes(targetType);
  const availableParents = parentCandidates.filter((t) => allowedParentTypes.includes(t.type));

  const handleParentChange = (newParentId: string) => {
    setTargetParentId(newParentId);
    if (newParentId === 'NONE') {
      // If was subtask, default to TASK
      if (targetType === 'SUB-TASK') {
        setTargetType('TASK');
      }
      return;
    }

    const selectedParent = tasks.find((t) => t.id === newParentId);
    if (!selectedParent) return;

    // Keep the current type when it is valid for the new parent, otherwise
    // switch to the first allowed child type.
    const allowedChildren = getAllowedChildTypes(selectedParent.type);
    if (!allowedChildren.includes(targetType)) {
      setTargetType(allowedChildren[0] || 'TASK');
    }
  };

  const handleTypeChange = (newType: Task['type']) => {
    setTargetType(newType);

    if (newType === 'INITIATIVE') {
      setTargetParentId('NONE');
      // An Initiative always enters its workflow at Backlog — a generic status
      // must never survive a conversion into an Initiative.
      setTargetStatus('BACKLOG');
      return;
    }

    // Leaving the Initiative type: the chain status is not a board status, so
    // fall back to a generic one instead of writing an unrenderable value.
    setTargetStatus(toGenericStatus(targetStatus));

    const parent = tasks.find((t) => t.id === targetParentId);
    if (parent && !isValidParentChild(parent.type, newType)) {
      // Fall back to an available parent of an allowed type (required for sub-tasks)
      const fallback = parentCandidates.find((t) => getAllowedParentTypes(newType).includes(t.type));
      setTargetParentId(fallback ? fallback.id : 'NONE');
    }
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();

    const parentIdVal = targetParentId === 'NONE' ? undefined : targetParentId;
    const parentTask = parentIdVal ? tasks.find((t) => t.id === parentIdVal) : undefined;

    if (targetType === 'SUB-TASK' && !parentTask) {
      toast.error('A Sub-task needs a parent work item');
      return;
    }

    if (parentTask && !isValidParentChild(parentTask.type, targetType)) {
      toast.error(
        `A ${getWorkItemLabel(targetType)} cannot be placed under a ${getWorkItemLabel(parentTask.type)}`
      );
      return;
    }

    // Everything checks out — show the confirmation state before applying.
    setStep('confirm');
  };

  const handleMove = () => {
    const parentIdVal = targetParentId === 'NONE' ? undefined : targetParentId;
    const sprintIdVal = targetSprintId === 'BACKLOG' ? undefined : targetSprintId;

    const res = moveTask(
      task.id,
      {
        projectId: targetProjectId,
        parentId: parentIdVal,
        sprintId: sprintIdVal,
        // Initiatives keep their workflow status; a conversion into an
        // Initiative always starts at Backlog (also enforced in the store).
        status: nextStatus,
        type: targetType,
      },
      currentUser?.id
    );

    if (res.ok) {
      toast.success(`Moved "${task.title}" successfully!`);
    } else {
      toast.error(res.reason || 'Status change refused — other move details were applied.');
    }
    onSuccess?.();
    onClose();
  };

  return (
    // Light dim (30%, no blur) instead of the old heavy 60% + blur overlay:
    // the page behind — e.g. the active sprint card and its work items on the
    // Iterations page — stays visible and readable while the modal is open,
    // and closing it returns the user to the exact same scroll position.
    // data-move-task-modal: lets the host page measure the modal's rect to
    // position background content (e.g. the active sprint) around it.
    <div
      data-move-task-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#f8fafd]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0b57d0]/10 flex items-center justify-center text-[#0b57d0]">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Move Work Item</h3>
              <p className="text-xs text-slate-500">
                Change parent work item, iteration, status, or work item type
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current task preview */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 font-medium">Selected Item:</span>
            <TaskTypeBadge type={task.type} />
            <span className="font-semibold text-slate-800 truncate max-w-[280px]">
              {task.title}
            </span>
          </div>
          <StatusBadge status={task.status} resolution={task.resolution} />
        </div>

        {/* Form / Confirmation (two-step: review before the move applies) */}
        {step === 'confirm' ? (
          <div className="p-6 space-y-4">
            {/* Confirmation state: key, title, source and destination */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
                Move Work Item
              </p>
              <p className="text-xs font-bold font-mono text-[#0052cc]">{workItemKey}</p>
              <p className="text-sm font-semibold text-slate-800">{task.title}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b778c] mb-0.5">
                  From:
                </p>
                <p className="font-semibold text-slate-800">
                  {iterationPath(sourceProject?.name, task.sprintId, 'Work Queue')}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b778c] mb-0.5">
                  To:
                </p>
                <p className="font-semibold text-slate-800">
                  {iterationPath(
                    targetProject?.name,
                    targetSprintId === 'BACKLOG' ? undefined : targetSprintId,
                    'Work Queue'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMove}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0842a0] rounded-xl shadow-xs transition-all"
              >
                <FolderInput className="w-3.5 h-3.5" />
                Move Work Item
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleReview} className="p-6 space-y-4">
          {/* Destination Project — the project this action was opened from.
              Read-only in this workflow: never an editable dropdown. */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
              Destination Project
            </label>
            <div className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 flex items-center gap-2">
              <span className="truncate">{targetProject?.name || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Parent */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                {getParentFieldLabel(targetType)}
              </label>
              <select
                value={targetParentId}
                onChange={(e) => handleParentChange(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] transition-all"
              >
                <option value="NONE">
                  {targetType === 'SUB-TASK' ? '— Select parent work item —' : '📂 Top-Level / Standalone (No parent)'}
                </option>
                {allowedParentTypes.map((parentType) => {
                  const group = availableParents.filter((t) => t.type === parentType);
                  if (group.length === 0) return null;
                  return (
                    <optgroup key={parentType} label={`${getWorkItemLabel(parentType)}s`}>
                      {group.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {getWorkItemLabel(parent.type)}: {parent.title}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {targetType === 'SUB-TASK' && targetParentId === 'NONE' && (
                <p className="mt-1 text-[10px] text-amber-600">
                  A Sub-task cannot be moved without a parent work item.
                </p>
              )}
            </div>

            {/* PI / Sprint — Work Queue (No Sprint) first as one selectable
                row (no heading), then one continuous chronological list of the
                centralized plan's sprints (no ACTIVE/PLANNED heading rows),
                using the "4.1 [29 SEP - 12 OCT]" display convention. The
                currently running sprint carries a green dot 🟢 from its real
                status. */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                PI / Sprint
              </label>
              <select
                value={targetSprintId}
                onChange={(e) => setTargetSprintId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] transition-all"
              >
                {/* Work Queue — one selectable row at the top, no heading.
                    Value 'BACKLOG' is the queue sentinel: handleMove maps it
                    to sprintId: undefined, clearing the assignment. */}
                <option value="BACKLOG">Work Queue (No Sprint)</option>
                {destinationSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.status === 'ACTIVE' ? `🟢 ${s.displayName}` : s.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                {destinationSprints.length > 0
                  ? 'Work Queue (No Sprint), then every active and planned iteration in chronological order — the running one is marked with a green dot.'
                  : 'No iterations available — the item stays in the Work Queue.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Status
              </label>
              <select
                value={nextStatus}
                onChange={(e) => setTargetStatus(e.target.value as TaskStatus)}
                disabled={statusLocked}
                className={`w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] transition-all ${
                  statusLocked ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {statusLocked ? (
                  <option value={nextStatus}>
                    {getStatusLabel(nextStatus)}
                  </option>
                ) : (
                  <>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </>
                )}
              </select>
              {isInitiative && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Initiative status is managed by the Initiative workflow.
                </p>
              )}
              {!isInitiative && willBeInitiative && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Initiatives always start at Backlog — later moves follow the Initiative workflow.
                </p>
              )}
            </div>

            {/* Target Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                Work Item Type
              </label>
              <select
                value={targetType}
                onChange={(e) => handleTypeChange(e.target.value as Task['type'])}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] transition-all"
              >
                <option value="INITIATIVE">Initiative</option>
                <option value="FEATURE">Feature</option>
                <option value="EPIC">Epic</option>
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="SUB-TASK">Sub-task</option>
                <option value="BUG_FIX">Bug Fix</option>
                <option value="IMPROVEMENT">Improvement</option>
              </select>
            </div>
          </div>

          {/* Quick Migration Summary — two equal columns with the arrow
              centered between them. Each column wraps its own long parent
              names / sprint labels (break-words) without pushing into the
              arrow or past the modal edge; re-renders live with every
              destination change. */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900">
            <div className="flex items-stretch gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-blue-700 block text-[11px] uppercase tracking-wider mb-1.5">
                  Current Location
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-slate-700 break-words">
                    {currentParent ? `Parent: ${currentParent.title}` : 'Parent: Standalone'}
                  </div>
                  <div className="text-slate-600 break-words">
                    {iterationLocation(task.sprintId, 'Work Queue')}
                  </div>
                </div>
              </div>

              <div className="flex items-center shrink-0">
                <ArrowRight className="w-4 h-4 text-blue-400" />
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-semibold text-blue-700 block text-[11px] uppercase tracking-wider mb-1.5">
                  New Location
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-blue-950 break-words">
                    {targetParentId === 'NONE'
                      ? 'Parent: Standalone'
                      : `Parent: ${
                          tasks.find((t) => t.id === targetParentId)?.title || 'Selected Parent'
                        }`}
                  </div>
                  <div className="text-blue-900 font-medium break-words">
                    {iterationLocation(
                      targetSprintId === 'BACKLOG' ? undefined : targetSprintId,
                      'Work Queue'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0842a0] rounded-xl shadow-xs transition-all"
            >
              <FolderInput className="w-3.5 h-3.5" />
              Review Move
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
