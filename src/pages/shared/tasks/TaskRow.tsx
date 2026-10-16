import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  CornerDownRight,
  CheckSquare,
  GripVertical,
  FolderInput,
  Flag,
  Pencil,
  Check,
  X,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../../store/appStore';
import { TaskTypeBadge } from './TaskTypeBadge';
import { StatusBadge, PriorityBadge } from '../../../components/common/Badges';
import { Avatar } from '../../../components/common/Avatar';
import { getDueDateLabel, getDueDateClass } from '../../../utils/dateUtils';
import type { Task, Project, Team, User } from '../../../types';

interface TaskRowProps {
  task: Task;
  level: number; // 0 for Epic, 1 for Task, 2 for Sub-task
  hasChildren: boolean;
  isExpanded: boolean;
  project?: Project;
  team?: Team;
  assignee?: User;
  childStats?: { total: number; completed: number };
  isSelected?: boolean;
  onToggleExpand: () => void;
  onToggleSelect?: () => void;
  onAddChild: (parentTask: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task) => void;
  onClick: (taskId: string) => void;
  // Drag & drop
  isDragging?: boolean;
  dropPosition?: 'before' | 'after' | 'inside' | null;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, task: Task) => void;
  onDragLeave?: (e: React.DragEvent, task: Task) => void;
  onDrop?: (e: React.DragEvent, task: Task) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  level,
  hasChildren,
  isExpanded,
  project,
  team,
  assignee,
  childStats,
  isSelected = false,
  onToggleExpand,
  onToggleSelect,
  onAddChild,
  onEdit,
  onDelete,
  onMove,
  onClick,
  isDragging = false,
  dropPosition = null,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const normType = String(task.type).toUpperCase().replace('_', '-');
  const isEpic = normType === 'EPIC';
  const isTask = normType === 'TASK' || normType === 'FEATURE' || normType === 'BUG-FIX';
  const isSubTask = normType === 'SUB-TASK' || normType === 'SUBTASK';

  const indentPadding = level === 0 ? 'pl-3' : level === 1 ? 'pl-8' : 'pl-14';

  const { updateTask } = useAppStore();
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState(task.description || '');

  // Row action menu: the only way to open a row's details (Open) or start the
  // existing move flow (Move Work Item). The row itself no longer navigates.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuWrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handleScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isEditingDesc) {
      setDescInput(task.description || '');
    }
  }, [task.description, isEditingDesc]);

  const handleSaveDesc = () => {
    updateTask(task.id, { description: descInput.trim() });
    setIsEditingDesc(false);
    toast.success(`Description updated for "${task.title}"`);
  };

  const handleCancelDesc = () => {
    setDescInput(task.description || '');
    setIsEditingDesc(false);
  };

  const progressPct =
    childStats && childStats.total > 0
      ? Math.round((childStats.completed / childStats.total) * 100)
      : 0;

  return (
    <tr
      className={`group hover:bg-[#f8fafd] transition-colors border-b border-slate-100 relative ${
        isEpic ? 'bg-[#fafbff]/60 font-medium' : ''
      } ${isSelected ? 'bg-blue-50/80' : ''} ${isDragging ? 'opacity-30 bg-indigo-50/50' : ''} ${
        dropPosition === 'before' ? 'border-t-2 !border-t-[#0b57d0] bg-[#0b57d0]/5' : ''
      } ${
        dropPosition === 'after' ? 'border-b-2 !border-b-[#0b57d0] bg-[#0b57d0]/5' : ''
      } ${
        dropPosition === 'inside'
          ? 'bg-indigo-50/80 ring-2 ring-inset ring-[#0b57d0] font-semibold'
          : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver?.(e, task);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeave?.(e, task);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop?.(e, task);
      }}
    >
      {/* Checkbox Column */}
      <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>

      {/* Title & Hierarchy Column */}
      <td className={`py-3 pr-4 ${indentPadding} min-w-[300px]`}>
        <div className="flex items-center gap-1.5">
          {/* Drag Handle */}
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart?.(e, task);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onDragEnd?.(e);
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 hover:text-slate-600 rounded hover:bg-slate-200/60 transition-colors flex-shrink-0"
            title="Drag to reorder or nest under an Epic/Task"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Tree connector indicator for child items */}
          {level === 1 && (
            <span className="text-slate-300 select-none flex-shrink-0 -ml-1 mr-0.5">
              └─
            </span>
          )}
          {level === 2 && (
            <span className="text-slate-300 select-none flex-shrink-0 -ml-1 mr-0.5">
              ↳
            </span>
          )}

          {/* Expand/Collapse Toggle or placeholder */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="w-5 h-5 rounded-md hover:bg-[#e0e2ec] flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors flex-shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-5 h-5 flex-shrink-0" />
          )}

          {/* Type Badge */}
          <TaskTypeBadge type={task.type} />

          {/* Title & Child Progress Bar */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`truncate ${
                  isEpic
                    ? 'font-bold text-slate-900 text-xs tracking-tight'
                    : isSubTask
                    ? 'text-slate-700 text-xs'
                    : 'font-semibold text-slate-800 text-xs'
                }`}
              >
                {task.title}
              </span>

              {/* Jira-Style Impediment Flag Badge */}
              {task.isFlagged && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex-shrink-0"
                  title={`Impediment: ${task.flaggedReason || 'Flagged'}`}
                >
                  <Flag className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                  <span>Impeded</span>
                </span>
              )}

              {/* Inside Drop indicator label */}
              {dropPosition === 'inside' && (
                <span className="text-[10px] bg-[#0b57d0] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                  Drop inside as child
                </span>
              )}

              {/* Progress & Child Counts */}
              {childStats && childStats.total > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded"
                  title={`${childStats.completed} of ${childStats.total} completed (${progressPct}%)`}
                >
                  <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        progressPct === 100
                          ? 'bg-emerald-500'
                          : isEpic
                          ? 'bg-purple-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="font-semibold text-[10px]">
                    {childStats.completed}/{childStats.total}
                  </span>
                </div>
              )}
            </div>

            {/* Task Description & Edit Option */}
            {isEditingDesc ? (
              <div
                className="mt-1 flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveDesc();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelDesc();
                    }
                  }}
                  autoFocus
                  placeholder="Enter task description..."
                  className="px-2 py-0.5 text-[11px] text-slate-800 bg-white border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-sm font-normal"
                />
                <button
                  type="button"
                  onClick={handleSaveDesc}
                  className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 shadow-2xs transition-colors flex-shrink-0"
                  title="Save description (Enter)"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelDesc}
                  className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
                  title="Cancel (Esc)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5 group/desc">
                {task.description ? (
                  <>
                    <p
                      className="text-[11px] text-slate-500 line-clamp-1 font-normal tracking-normal cursor-text hover:text-slate-700 transition-colors"
                      title={`${task.description} (Click pencil to edit)`}
                    >
                      {task.description}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDescInput(task.description || '');
                        setIsEditingDesc(true);
                      }}
                      className="opacity-0 group-hover/desc:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-all flex-shrink-0"
                      title="Edit description"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDescInput('');
                      setIsEditingDesc(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center gap-1 transition-opacity font-normal"
                    title="Add description"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>Add description</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Project */}
      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[140px]">
        {project?.name || '—'}
      </td>

      {/* Team */}
      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[130px]">
        {team?.name || '—'}
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        {assignee ? (
          <div className="flex items-center gap-2">
            <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
            <span className="text-xs text-slate-700 truncate max-w-[120px]">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic text-xs">Unassigned</span>
        )}
      </td>

      {/* Priority */}
      <td className="px-4 py-3">
        <PriorityBadge priority={task.priority} />
      </td>

      {/* Story Points */}
      <td className="px-4 py-3 text-center">
        {task.storyPoints ? (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
            {task.storyPoints}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={task.status} resolution={task.resolution} />
      </td>

      {/* Due Date */}
      <td className={`px-4 py-3 text-xs whitespace-nowrap ${getDueDateClass(task.dueDate)}`}>
        {getDueDateLabel(task.dueDate)}
      </td>

      {/* Quick Action Buttons */}
      <td
        className="px-3 py-3 text-right whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1">
          {/* Row action menu trigger — always visible; the row itself never navigates. */}
          <span ref={menuWrapRef} className="relative inline-flex">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const MENU_W = 176;
                setMenuPos({
                  x: Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8)),
                  y: Math.min(rect.bottom + 4, window.innerHeight - 88),
                });
                setMenuOpen((o) => !o);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Row actions"
              aria-label={`Actions for ${task.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && menuPos && (
              <div
                role="menu"
                className="fixed z-50 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in"
                style={{ left: menuPos.x, top: menuPos.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onClick(task.id);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  Open
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onMove(task);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                  Move Work Item
                </button>
              </div>
            )}
          </span>

          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {/* + Add Child Button */}
          {isEpic && (
            <button
              type="button"
              onClick={() => onAddChild(task)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#0b57d0] text-[11px] font-semibold transition-colors shadow-2xs"
              title="Add Task under this Epic"
            >
              <Plus className="w-3 h-3" />
              <span>Add Task</span>
            </button>
          )}

          {isTask && (
            <button
              type="button"
              onClick={() => onAddChild(task)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ecfeff] hover:bg-[#cffafe] text-[#0891b2] text-[11px] font-semibold transition-colors shadow-2xs"
              title="Add Sub-task under this Task"
            >
              <Plus className="w-3 h-3" />
              <span>Add Sub-task</span>
            </button>
          )}

          {/* Move Button */}
          <button
            type="button"
            onClick={() => onMove(task)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#0b57d0] transition-colors"
            title="Move work item (change iteration, parent epic, status, or reorder)"
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            title="Edit work item"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Delete work item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          </div>
        </div>
      </td>
    </tr>
  );
};
