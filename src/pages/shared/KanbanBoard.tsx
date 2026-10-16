import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import type { TaskStatus } from '../../types';
import { getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { issuePath } from '../../utils/issueUrl';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import { MoreHorizontal, Clock, AlertTriangle, ShieldAlert, Filter, Flag } from 'lucide-react';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import { FlagTaskModal } from '../../components/common/FlagTaskModal';
import { InitiativeBoard } from './InitiativeBoard';
import type { Task } from '../../types';

interface KanbanBoardProps {
  projectId?: string;
  taskIds?: string[];
}

const columns: { id: TaskStatus; label: string; color: string; bgColor: string; headerBg: string; dotColor: string; wipLimit?: number }[] = [
  { id: 'TODO', label: 'Queued', color: 'border-[#94a3b8]', bgColor: 'bg-[#f8fafc]', headerBg: 'bg-gradient-to-r from-slate-50 to-slate-100', dotColor: 'bg-[#94a3b8]' },
  { id: 'IN_PROGRESS', label: 'Executing', color: 'border-[#0d9488]', bgColor: 'bg-[#f0fdfa]', headerBg: 'bg-gradient-to-r from-teal-50 to-emerald-50', dotColor: 'bg-[#0d9488]', wipLimit: 6 },
  { id: 'BLOCKED', label: 'Blocked', color: 'border-[#ef4444]', bgColor: 'bg-[#fef2f2]', headerBg: 'bg-gradient-to-r from-red-50 to-rose-50', dotColor: 'bg-[#ef4444]' },
  { id: 'IN_REVIEW', label: 'Review', color: 'border-[#6366f1]', bgColor: 'bg-[#eef2ff]', headerBg: 'bg-gradient-to-r from-indigo-50 to-violet-50', dotColor: 'bg-[#6366f1]', wipLimit: 4 },
  { id: 'TESTING', label: 'Verification', color: 'border-[#f59e0b]', bgColor: 'bg-[#fffbeb]', headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50', dotColor: 'bg-[#f59e0b]', wipLimit: 4 },
  { id: 'BUG_FIX', label: 'Hotfix', color: 'border-[#ef4444]', bgColor: 'bg-[#fef2f2]', headerBg: 'bg-gradient-to-r from-red-50 to-rose-50', dotColor: 'bg-[#ef4444]' },
  { id: 'RETEST', label: 'Re-verify', color: 'border-[#f97316]', bgColor: 'bg-[#fff7ed]', headerBg: 'bg-gradient-to-r from-orange-50 to-amber-50', dotColor: 'bg-[#f97316]' },
  { id: 'DONE', label: 'Delivered', color: 'border-[#10b981]', bgColor: 'bg-[#ecfdf5]', headerBg: 'bg-gradient-to-r from-emerald-50 to-green-50', dotColor: 'bg-[#10b981]' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, taskIds }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { tasks, users, updateTaskStatus, toggleTaskFlag } = useAppStore();

  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [selectedFlagTask, setSelectedFlagTask] = useState<Task | null>(null);

  const boardTasks = taskIds
    ? tasks.filter((t) => taskIds.includes(t.id))
    : projectId
      ? tasks.filter((t) => t.projectId === projectId)
      : tasks;

  const flaggedCount = useMemo(() => boardTasks.filter((t) => t.isFlagged).length, [boardTasks]);

  const filteredTasks = useMemo(() => {
    let result = boardTasks;
    if (assigneeFilter !== 'ALL') result = result.filter((t) => t.assigneeId === assigneeFilter);
    if (priorityFilter !== 'ALL') result = result.filter((t) => t.priority === priorityFilter);
    if (flaggedOnly) result = result.filter((t) => t.isFlagged);
    return result;
  }, [boardTasks, assigneeFilter, priorityFilter, flaggedOnly]);

  // Initiatives follow their own 10-stage workflow on the Initiative Board —
  // they are never rendered (or moved) through the generic columns below.
  const initiativeTasks = useMemo(() => filteredTasks.filter((t) => t.type === 'INITIATIVE'), [filteredTasks]);
  const workTasks = useMemo(() => filteredTasks.filter((t) => t.type !== 'INITIATIVE'), [filteredTasks]);

  const getColumnIndex = (status: TaskStatus): number => {
    const order: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'TESTING', 'BUG_FIX', 'RETEST', 'DONE'];
    return order.indexOf(status);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // An Initiative dragged onto a generic column belongs on the Initiative
    // Board — refuse with a visible message instead of mangling its workflow.
    if (task.type === 'INITIATIVE') {
      toast.error('Initiatives move on the Initiative Board above — one workflow step at a time.');
      return;
    }

    const currentIndex = getColumnIndex(task.status);
    const targetIndex = getColumnIndex(targetStatus);

    if (targetIndex < currentIndex) {
      toast.error(`Cannot move task backward to previous stage (${targetStatus.replace(/_/g, ' ')}). Progression is permanent.`);
      return;
    }

    if (targetIndex > currentIndex + 1) {
      const nextCol = columns[currentIndex + 1];
      toast.error(`Tasks must move step-by-step! Move to ${nextCol ? nextCol.label : 'next stage'} first.`);
      return;
    }

    if (targetIndex === currentIndex) return;

    const res = updateTaskStatus(taskId, targetStatus, currentUser?.id || 'u-admin-01');
    if (res.ok) {
      toast.success(`Task moved to ${targetStatus.replace(/_/g, ' ')}`);
    } else {
      toast.error(res.reason || 'That move is not allowed.');
    }
  };

  // Iteration progress summary — cancelled work is out of scope: it is never
  // counted as done and never inflates the denominator. Initiatives are counted
  // on the Initiative Board, not in execution progress.
  const cancelledTasks = workTasks.filter((t) => isCancelledWorkItem(t)).length;
  const totalTasks = workTasks.length - cancelledTasks;
  const doneTasks = workTasks.filter((t) => t.status === 'DONE' && !isCancelledWorkItem(t)).length;
  const blockedTasks = workTasks.filter((t) => t.status === 'BLOCKED').length;
  const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Board Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#1a1d23]">Execution Board</h3>
          <p className="text-[11px] text-[#9ca3af]">Drag cards to progress work items through stages</p>
        </div>        <div className="flex items-center gap-3">
          {/* Iteration Progress Summary */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-semibold text-slate-600">{overallProgress}% complete</span>
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-slate-400">{doneTasks}/{totalTasks}</span>
            {blockedTasks > 0 && (
              <span className="flex items-center gap-0.5 text-red-500 font-bold">
                <ShieldAlert className="w-3 h-3" /> {blockedTasks}
              </span>
            )}
          </div>
          {/* Filters */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white">
              <option value="ALL">All Assignees</option>
              {users.filter((u) => boardTasks.some((t) => t.assigneeId === u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white">
              <option value="ALL">All Priority</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <button
              onClick={() => setFlaggedOnly(!flaggedOnly)}
              className={`text-[10px] border rounded-lg px-2 py-1 flex items-center gap-1 transition-all cursor-pointer ${
                flaggedOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filter to only show tasks flagged as impeded"
            >
              <Flag className={`w-3 h-3 ${flaggedOnly ? 'fill-amber-600 text-amber-600' : 'text-slate-400'}`} />
              <span>Impeded {flaggedCount > 0 && `(${flaggedCount})`}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#9ca3af]">
            <span className="w-2 h-2 rounded-full bg-[#0d9488] animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* Initiative Board — dedicated 10-stage workflow columns */}
      {initiativeTasks.length > 0 && <InitiativeBoard tasks={initiativeTasks} />}

      {/* Board Columns */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
        {columns.map((col) => {
          const colTasks = workTasks.filter((t) => t.status === col.id);
          const progressPct = workTasks.length > 0 ? Math.round((colTasks.length / workTasks.length) * 100) : 0;
          const isOverWip = col.wipLimit && colTasks.length > col.wipLimit;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-72 flex-shrink-0 rounded-2xl border bg-[#f8f9fb] transition-all hover:shadow-lg hover:shadow-[#0d9488]/5 ${isOverWip ? 'border-red-300' : col.color}`}
            >
              {/* Column Header */}
              <div className={`${col.headerBg} px-4 py-3 rounded-t-2xl border-b ${col.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h3 className="text-xs font-bold text-[#1a1d23] uppercase tracking-wider">{col.label}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {col.wipLimit && (
                      <span className={`text-[9px] font-bold ${isOverWip ? 'text-red-600' : 'text-slate-400'}`}>
                        WIP: {colTasks.length}/{col.wipLimit}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm ${isOverWip ? 'bg-red-100 text-red-700' : 'bg-white/80 text-[#1a1d23]'}`}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>
                {/* Column Progress Bar */}
                <div className="w-full h-1 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: col.id === 'DONE' ? '#10b981' : col.id === 'IN_PROGRESS' ? '#0d9488' : '#94a3b8',
                    }}
                  />
                </div>
                <div className="text-[9px] text-[#9ca3af] mt-1 text-right">{progressPct}% of total</div>
              </div>

              {/* Task Cards */}
              <div className="p-3 space-y-3 min-h-[350px]">
                {colTasks.length === 0 ? (
                  <div className="h-28 rounded-xl border border-dashed border-[#d1d5db] flex flex-col items-center justify-center text-xs text-[#9ca3af] gap-1">
                    <span>No work items</span>
                    <span className="text-[9px]">Drag a card here</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const assignee = users.find((u) => u.id === task.assigneeId);
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
                    const isFlagged = task.isFlagged;
                    const isCancelled = isCancelledWorkItem(task);

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className={`rounded-xl p-3.5 border shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-150 group relative ${
                          isFlagged
                            ? 'bg-amber-50/50 border-amber-300 border-l-4 border-l-amber-500 hover:border-amber-400'
                            : isCancelled
                              ? 'bg-slate-50 border-slate-300 opacity-80 hover:border-slate-400'
                              : 'bg-white border-[#e2e5ea] hover:border-[#0d9488]'
                        }`}
                        onClick={() => navigate(issuePath(task))}
                      >
                        {/* Overdue indicator */}
                        {isOverdue && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] flex items-center justify-center">
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {/* Blocked indicator */}
                        {task.status === 'BLOCKED' && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#f97316] flex items-center justify-center">
                            <ShieldAlert className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-[#1a1d23] line-clamp-2 flex-1 group-hover:text-[#0d9488] transition-colors">
                            {task.title}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Flag Impediment Action Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFlagTask(task);
                              }}
                              className={`p-1 rounded-md transition-colors ${
                                isFlagged
                                  ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                                  : 'text-slate-300 hover:text-amber-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100'
                              }`}
                              title={isFlagged ? `Impediment: ${task.flaggedReason}` : 'Flag as impeded'}
                            >
                              <Flag className={`w-3 h-3 ${isFlagged ? 'fill-amber-500 text-amber-600' : ''}`} />
                            </button>

                            {task.storyPoints && (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#0d9488]/10 text-[#0d9488] text-[10px] font-bold">
                                {task.storyPoints}
                              </span>
                            )}
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </div>

                        {/* Jira-style Impeded Banner on Card */}
                        {isFlagged && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFlagTask(task);
                            }}
                            className="mb-2.5 p-1.5 rounded-lg bg-amber-100/90 border border-amber-300/80 flex items-center justify-between gap-1 text-[10px] text-amber-900 cursor-pointer hover:bg-amber-200/90 transition-colors shadow-2xs"
                            title={`Flagged Impediment: ${task.flaggedReason || 'Needs team attention'}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Flag className="w-3 h-3 fill-amber-600 text-amber-600 flex-shrink-0" />
                              <span className="font-semibold truncate">{task.flaggedReason || 'Impeded'}</span>
                            </div>
                            <span className="text-[9px] font-bold text-amber-700 underline flex-shrink-0">Edit</span>
                          </div>
                        )}

                        {task.description && (
                          <p className="text-[11px] text-[#9ca3af] line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-2.5 border-t border-[#f1f3f4] text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[9px] font-bold uppercase tracking-wide">
                                Cancelled
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${getDueDateClass(task.dueDate)}`}>
                                {getDueDateLabel(task.dueDate)}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[9px] text-[#ef4444] font-bold">OVERDUE</span>
                            )}
                          </div>
                          {assignee && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[#9ca3af] truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
                              <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Jira-Style Flag / Impediment Modal */}
      {selectedFlagTask && (
        <FlagTaskModal
          isOpen={!!selectedFlagTask}
          onClose={() => setSelectedFlagTask(null)}
          task={selectedFlagTask}
          onSave={(reason) => {
            toggleTaskFlag(selectedFlagTask.id, true, reason, currentUser?.id);
            toast.success(`Task "${selectedFlagTask.title}" flagged as impeded`);
            setSelectedFlagTask(null);
          }}
          onRemoveFlag={() => {
            toggleTaskFlag(selectedFlagTask.id, false, undefined, currentUser?.id);
            toast.success('Impediment flag removed');
            setSelectedFlagTask(null);
          }}
        />
      )}
    </div>
  );
};
