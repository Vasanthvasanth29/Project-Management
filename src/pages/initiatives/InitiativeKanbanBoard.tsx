import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, PauseCircle, RotateCcw, ChevronDown, Layers, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { issuePath } from '../../utils/issueUrl';
import { getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { calculateInitiativeProgress, isInitiativeOverdue } from '../../utils/initiativeProgress';
import {
  INITIATIVE_BOARD_STATUS_LABEL,
  initiativeBoardStatusOf,
  getAllowedInitiativeBoardMoves,
  planInitiativeBoardMove,
  explainInitiativeBoardMove,
} from '../../utils/initiativeWorkflow';
import type { InitiativeBoardStatus } from '../../utils/initiativeWorkflow';
import type { Task } from '../../types';

interface InitiativeKanbanBoardProps {
  initiatives: Task[];
}

interface ColumnStyle {
  border: string;
  headerBg: string;
  dot: string;
}

const COLUMN_STYLES: Record<InitiativeBoardStatus, ColumnStyle> = {
  BACKLOG: {
    border: 'border-slate-300',
    headerBg: 'bg-gradient-to-r from-slate-50 to-slate-100',
    dot: 'bg-slate-400',
  },
  PLANNED: {
    border: 'border-indigo-300',
    headerBg: 'bg-gradient-to-r from-indigo-50 to-violet-50',
    dot: 'bg-indigo-500',
  },
  IN_PROGRESS: {
    border: 'border-teal-300',
    headerBg: 'bg-gradient-to-r from-teal-50 to-emerald-50',
    dot: 'bg-teal-600',
  },
  ON_HOLD: {
    border: 'border-amber-400',
    headerBg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
    dot: 'bg-amber-500',
  },
  COMPLETED: {
    border: 'border-emerald-400',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-green-50',
    dot: 'bg-emerald-500',
  },
};

const COLUMN_ORDER: InitiativeBoardStatus[] = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
];

/**
 * The Initiative Board: five board columns (Backlog / Planned / In Progress /
 * On Hold / Completed) over the centralised Initiative workflow. Moves are
 * validated against the chain rules before they reach the store; refused
 * drops surface a toast with the reason — never a silent no-op. On Hold
 * cards resume to the stage recorded on the record; Completed is terminal.
 */
export const InitiativeKanbanBoard: React.FC<InitiativeKanbanBoardProps> = ({ initiatives }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { users, tasks, updateTaskStatus } = useAppStore();
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  const actorId = currentUser?.id || 'u-admin-01';

  const boardTasks = useMemo(
    () => initiatives.filter((t) => t.type === 'INITIATIVE' && !t.isArchived),
    [initiatives]
  );

  const moveInitiative = (task: Task, to: InitiativeBoardStatus) => {
    if (initiativeBoardStatusOf(task.status) === to) return;
    const plan = planInitiativeBoardMove(task.status, to, task.initiativePreviousStatus);
    if (!plan.ok) {
      toast.error(plan.reason || explainInitiativeBoardMove(task.status, to, task.initiativePreviousStatus));
      return;
    }
    for (const step of plan.steps) {
      const res = updateTaskStatus(task.id, step, actorId);
      if (!res.ok) {
        toast.error(res.reason || 'That move is not allowed.');
        return;
      }
    }
    toast.success(`Initiative moved to ${INITIATIVE_BOARD_STATUS_LABEL[to]}`);
  };

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

  const handleDrop = (e: React.DragEvent, to: InitiativeBoardStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = boardTasks.find((t) => t.id === taskId);
    if (!task) {
      toast.error('Only Initiatives move through this board.');
      return;
    }
    moveInitiative(task, to);
  };

  const handleResume = (task: Task) => {
    if (!task.initiativePreviousStatus) {
      toast.error('This Initiative has no stage recorded to resume to.');
      return;
    }
    moveInitiative(task, initiativeBoardStatusOf(task.initiativePreviousStatus));
  };

  const renderCard = (task: Task) => {
    const owner = users.find((u) => u.id === task.assigneeId);
    const isOverdue = isInitiativeOverdue(task);
    const progress = calculateInitiativeProgress(task, tasks);
    const epicCount = task.linkedEpicIds?.length ?? 0;
    const allowedMoves = getAllowedInitiativeBoardMoves(task.status, task.initiativePreviousStatus);
    const menuOpen = menuTaskId === task.id;

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

        {task.description && (
          <p className="text-[11px] text-[#9ca3af] line-clamp-2 mb-2.5 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Linked Epic count + progress (only when linked work exists) */}
        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#5e6470]">
          <Layers className="w-3 h-3 text-[#0d9488]" />
          <span className="font-semibold">
            {epicCount} Epic{epicCount === 1 ? '' : 's'}
          </span>
          {progress.hasLinkedWork ? (
            <span className="text-[#9ca3af]">
              · {progress.completed}/{progress.total} items · {progress.percent}%
            </span>
          ) : (
            <span className="text-[#9ca3af]">· no linked work</span>
          )}
        </div>
        {progress.hasLinkedWork && progress.percent !== null && (
          <div className="w-full h-1 bg-[#f1f5f9] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0d9488] to-[#10b981] transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2.5 border-t border-[#f1f3f4] text-[11px]">
          <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${getDueDateClass(task.dueDate)}`}>
            {getDueDateLabel(task.dueDate)}
          </span>
          {owner && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#9ca3af] truncate max-w-[80px]">
                {owner.name.split(' ')[0]}
              </span>
              <Avatar name={owner.name} color={owner.avatarColor} size="xs" />
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
                ? `Resume to ${INITIATIVE_BOARD_STATUS_LABEL[initiativeBoardStatusOf(task.initiativePreviousStatus)]}`
                : 'No stage recorded to resume to'
            }
          >
            <RotateCcw className="w-3 h-3" />
            Resume
            {task.initiativePreviousStatus
              ? ` to ${INITIATIVE_BOARD_STATUS_LABEL[initiativeBoardStatusOf(task.initiativePreviousStatus)]}`
              : ''}
          </button>
        )}

        {/* Keyboard/menu alternative to drag-and-drop */}
        <div className="mt-2 relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuTaskId(menuOpen ? null : task.id);
            }}
            className="w-full flex items-center justify-center gap-1 rounded-lg border border-[#e2e5ea] px-2 py-1.5 text-[10px] font-bold text-[#5e6470] hover:bg-[#f8fafc] transition-colors cursor-pointer"
            aria-label="Move Initiative"
          >
            <MoreHorizontal className="w-3 h-3" />
            Move
            <ChevronDown className="w-3 h-3" />
          </button>
          {menuOpen && allowedMoves.length > 0 && (
            <div className="absolute left-0 right-0 bottom-full mb-1 z-20 rounded-lg border border-[#e2e5ea] bg-white shadow-md overflow-hidden">
              {allowedMoves.map((m) => (
                <button
                  key={m.to}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTaskId(null);
                    moveInitiative(task, m.to);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-[#1a1d23] hover:bg-[#f0fdfa] hover:text-[#0d9488] transition-colors"
                >
                  {INITIATIVE_BOARD_STATUS_LABEL[m.to]}
                </button>
              ))}
            </div>
          )}
          {menuOpen && allowedMoves.length === 0 && (
            <div className="absolute left-0 right-0 bottom-full mb-1 z-20 rounded-lg border border-[#e2e5ea] bg-white shadow-md px-3 py-1.5 text-[10px] font-medium text-[#9ca3af]">
              {task.status === 'COMPLETED'
                ? 'Completed is final'
                : 'No moves available'}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (id: InitiativeBoardStatus) => {
    const style = COLUMN_STYLES[id];
    const colTasks = boardTasks.filter((t) => initiativeBoardStatusOf(t.status) === id);
    const isTerminal = id === 'COMPLETED';

    return (
      <div
        key={id}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, id)}
        className={`w-72 flex-shrink-0 rounded-2xl border bg-[#f8f9fb] transition-all hover:shadow-lg hover:shadow-[#0d9488]/5 ${style.border}`}
      >
        <div className={`${style.headerBg} px-4 py-3 rounded-t-2xl border-b ${style.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <h3 className="text-[11px] font-bold text-[#1a1d23] uppercase tracking-wider">
                {INITIATIVE_BOARD_STATUS_LABEL[id]}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/80 text-[#1a1d23] shadow-sm">
              {colTasks.length}
            </span>
          </div>
          {isTerminal && (
            <div className="text-[9px] font-bold text-emerald-700 mt-1 uppercase tracking-wide">
              Terminal — no further moves
            </div>
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

  const onHoldCount = boardTasks.filter((t) => t.status === 'ON_HOLD').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#1a1d23]">Initiative Board</h3>
          <p className="text-[11px] text-[#9ca3af]">
            {boardTasks.length} Initiative{boardTasks.length === 1 ? '' : 's'} — one stage at a
            time through the workflow
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
        {COLUMN_ORDER.map((status) => renderColumn(status))}
        <div className="flex-shrink-0 w-px self-stretch bg-slate-200 ml-4" />
        {renderColumn('ON_HOLD')}
      </div>
    </div>
  );
};
