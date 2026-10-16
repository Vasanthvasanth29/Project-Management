import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { issuePath } from '../../utils/issueUrl';
import { getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { getStatusLabel } from '../../utils/roleUtils';
import {
  INITIATIVE_WORKFLOW_CHAIN,
  canTransitionInitiative,
  explainInitiativeTransition,
  initiativeBoardColumn,
} from '../../utils/initiativeWorkflow';
import type { InitiativeWorkflowStatus, Task } from '../../types';
import { AlertTriangle, PauseCircle, RotateCcw } from 'lucide-react';

/**
 * The dedicated Initiative board: the 10-stage Initiative workflow rendered as
 * its own columns (plus the On Hold side lane), separate from the generic
 * Execution Board. Every move is validated against the centralised rules in
 * `initiativeWorkflow.ts` before it reaches the store; refused drops are shown
 * as a user-visible error, never a silent no-op or a false success toast.
 */

interface InitiativeBoardProps {
  tasks: Task[];
}

interface ColumnStyle {
  border: string;
  headerBg: string;
  dot: string;
}

const CHAIN_COLUMN_STYLES: Record<InitiativeWorkflowStatus, ColumnStyle> = {
  BACKLOG: { border: 'border-slate-300', headerBg: 'bg-gradient-to-r from-slate-50 to-slate-100', dot: 'bg-slate-400' },
  ASSESSMENT: { border: 'border-orange-300', headerBg: 'bg-gradient-to-r from-orange-50 to-amber-50', dot: 'bg-orange-500' },
  ON_BOARD: { border: 'border-indigo-300', headerBg: 'bg-gradient-to-r from-indigo-50 to-violet-50', dot: 'bg-indigo-500' },
  READY_FOR_DEVELOPMENT: { border: 'border-blue-300', headerBg: 'bg-gradient-to-r from-blue-50 to-sky-50', dot: 'bg-blue-500' },
  IN_DEVELOPMENT: { border: 'border-teal-300', headerBg: 'bg-gradient-to-r from-teal-50 to-emerald-50', dot: 'bg-teal-600' },
  DEVELOPMENT_COMPLETE: { border: 'border-purple-300', headerBg: 'bg-gradient-to-r from-purple-50 to-fuchsia-50', dot: 'bg-purple-500' },
  READY_FOR_DEPLOYMENT: { border: 'border-indigo-300', headerBg: 'bg-gradient-to-r from-indigo-50 to-blue-50', dot: 'bg-indigo-500' },
  DEPLOYMENT: { border: 'border-orange-300', headerBg: 'bg-gradient-to-r from-orange-50 to-rose-50', dot: 'bg-orange-500' },
  VALIDATION: { border: 'border-blue-300', headerBg: 'bg-gradient-to-r from-blue-50 to-cyan-50', dot: 'bg-blue-500' },
  COMPLETED: { border: 'border-emerald-400', headerBg: 'bg-gradient-to-r from-emerald-50 to-green-50', dot: 'bg-emerald-500' },
  ON_HOLD: { border: 'border-amber-400', headerBg: 'bg-gradient-to-r from-amber-50 to-yellow-50', dot: 'bg-amber-500' },
};

export const InitiativeBoard: React.FC<InitiativeBoardProps> = ({ tasks }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { users, updateTaskStatus } = useAppStore();

  const actorId = currentUser?.id || 'u-admin-01';

  const boardTasks = useMemo(
    () => tasks.filter((t) => t.type === 'INITIATIVE'),
    [tasks]
  );

  // Legacy statuses (TODO / IN_PROGRESS / DONE) land on their mapped chain
  // column so old records render in a sensible place.
  const bucketOf = (task: Task): InitiativeWorkflowStatus => initiativeBoardColumn(task.status);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.dropEffect = 'move';
    e.dataTransfer.effectAllowed = 'move';
  };

  // Always allow the drop so a refused move can explain itself — blocking the
  // drop at drag time would fail silently with no message.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const moveInitiative = (task: Task, target: InitiativeWorkflowStatus) => {
    if (task.status === target) return;
    if (!canTransitionInitiative(task.status, target, task.initiativePreviousStatus)) {
      toast.error(explainInitiativeTransition(task.status, target, task.initiativePreviousStatus));
      return;
    }
    const res = updateTaskStatus(task.id, target, actorId);
    if (res.ok) {
      toast.success(`Initiative moved to ${getStatusLabel(target)}`);
    } else {
      toast.error(res.reason || 'That move is not allowed.');
    }
  };

  const handleDrop = (e: React.DragEvent, target: InitiativeWorkflowStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = boardTasks.find((t) => t.id === taskId);
    if (!task) {
      // A card dragged in from the generic Execution Board (or elsewhere).
      toast.error('Only Initiatives move through this workflow — use the Execution Board for tasks, stories and bugs.');
      return;
    }
    if (bucketOf(task) === target) return;
    moveInitiative(task, target);
  };

  const handleResume = (task: Task) => {
    if (!task.initiativePreviousStatus) {
      toast.error('This Initiative has no stage recorded to resume to.');
      return;
    }
    moveInitiative(task, task.initiativePreviousStatus);
  };

  const renderCard = (task: Task) => {
    const assignee = users.find((u) => u.id === task.assigneeId);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={() => navigate(issuePath(task))}
        className="rounded-xl p-3.5 border bg-white border-[#e2e5ea] hover:border-[#0d9488] shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-150 group relative"
      >
        {isOverdue && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] flex items-center justify-center">
            <AlertTriangle className="w-2.5 h-2.5 text-white" />
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-[#1a1d23] line-clamp-2 flex-1 group-hover:text-[#0d9488] transition-colors">
            {task.title}
          </span>
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <StatusBadge status={task.status} />
        </div>

        {task.description && (
          <p className="text-[11px] text-[#9ca3af] line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
        )}

        <div className="flex items-center justify-between pt-2.5 border-t border-[#f1f3f4] text-[11px]">
          <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${getDueDateClass(task.dueDate)}`}>
            {getDueDateLabel(task.dueDate)}
          </span>
          {assignee && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#9ca3af] truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
              <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
            </div>
          )}
        </div>

        {task.status === 'ON_HOLD' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResume(task);
            }}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 border border-amber-300 px-2 py-1.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            title={
              task.initiativePreviousStatus
                ? `Resume to ${getStatusLabel(task.initiativePreviousStatus)}`
                : 'No stage recorded to resume to'
            }
          >
            <RotateCcw className="w-3 h-3" />
            Resume{task.initiativePreviousStatus ? ` to ${getStatusLabel(task.initiativePreviousStatus)}` : ''}
          </button>
        )}
      </div>
    );
  };

  const renderColumn = (id: InitiativeWorkflowStatus, opts?: { separated?: boolean }) => {
    const style = CHAIN_COLUMN_STYLES[id];
    const colTasks = boardTasks.filter((t) => bucketOf(t) === id);
    const isTerminal = id === 'COMPLETED';

    return (
      <div
        key={id}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, id)}
        className={`w-64 flex-shrink-0 rounded-2xl border bg-[#f8f9fb] transition-all hover:shadow-lg hover:shadow-[#0d9488]/5 ${style.border} ${opts?.separated ? 'ml-6' : ''}`}
      >
        <div className={`${style.headerBg} px-4 py-3 rounded-t-2xl border-b ${style.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <h3 className="text-[11px] font-bold text-[#1a1d23] uppercase tracking-wider">{getStatusLabel(id)}</h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/80 text-[#1a1d23] shadow-sm">
              {colTasks.length}
            </span>
          </div>
          {isTerminal && (
            <div className="text-[9px] font-bold text-emerald-700 mt-1 uppercase tracking-wide">Terminal — no further moves</div>
          )}
          {id === 'ON_HOLD' && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-amber-700 mt-1">
              <PauseCircle className="w-3 h-3" />
              Paused — resumes where it left off
            </div>
          )}
        </div>

        <div className="p-3 space-y-3 min-h-[220px]">
          {colTasks.length === 0 ? (
            <div className="h-20 rounded-xl border border-dashed border-[#d1d5db] flex items-center justify-center text-[11px] text-[#9ca3af]">
              {id === 'ON_HOLD' ? 'Nothing on hold' : 'Drag an Initiative here'}
            </div>
          ) : (
            colTasks.map(renderCard)
          )}
        </div>
      </div>
    );
  };

  if (boardTasks.length === 0) return null;

  const onHoldCount = boardTasks.filter((t) => t.status === 'ON_HOLD').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#1a1d23]">Initiative Board</h3>
          <p className="text-[11px] text-[#9ca3af]">
            {boardTasks.length} Initiative{boardTasks.length === 1 ? '' : 's'} — one step at a time through the workflow
          </p>
        </div>
        {onHoldCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-300 px-2.5 py-1 text-[10px] font-bold text-amber-800">
            <PauseCircle className="w-3.5 h-3.5" />
            {onHoldCount} On Hold
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
        {INITIATIVE_WORKFLOW_CHAIN.map((status) => renderColumn(status))}
        <div className="flex-shrink-0 w-px self-stretch bg-slate-200 ml-4" />
        {renderColumn('ON_HOLD', { separated: true })}
      </div>
    </div>
  );
};
