import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Layers,
  CheckSquare,
  CornerDownRight,
  FolderKanban,
  Trash2,
  Users,
  ArrowRight,
  Flag,
  GripVertical,
  FolderInput,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getStatusLabel } from '../../utils/roleUtils';
import { TaskRow } from './tasks/TaskRow';
import { CreateWorkItemModal } from './tasks/CreateWorkItemModal';
import { EditTaskModal } from './tasks/EditTaskModal';
import { DeleteTaskModal } from './tasks/DeleteTaskModal';
import { MoveTaskModal } from './tasks/MoveTaskModal';
import { issuePath } from '../../utils/issueUrl';
import { isValidParentChild, getWorkItemLabel, ROOT_CREATABLE_TYPES } from '../../utils/workItemHierarchy';
import type { Task, TaskStatus, Priority, WorkItemType } from '../../types';

interface TasksListPageProps {
  projectId?: string;
  showBacklogOnly?: boolean;
}

// Helper to check if candidateId is self or descendant of parentId
const isDescendantOrSelf = (parentId: string, candidateId: string, allTasks: Task[]): boolean => {
  if (parentId === candidateId) return true;
  const childMap = new Map<string, string[]>();
  allTasks.forEach((t) => {
    if (t.parentId) {
      const list = childMap.get(t.parentId) || [];
      list.push(t.id);
      childMap.set(t.parentId, list);
    }
  });

  const queue = [parentId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = childMap.get(curr) || [];
    for (const child of children) {
      if (child === candidateId) return true;
      queue.push(child);
    }
  }
  return false;
};

/**
 * Child type produced by dropping `draggedType` inside `targetType`,
 * or null when that placement breaks the work item hierarchy.
 */
const resolveDropInsideType = (
  targetType: WorkItemType,
  draggedType: WorkItemType
): WorkItemType | null => {
  let childType = draggedType;
  if (targetType === 'EPIC' && childType === 'EPIC') childType = 'TASK';
  if (!isValidParentChild(targetType, childType) && isValidParentChild(targetType, 'SUB-TASK')) {
    childType = 'SUB-TASK';
  }
  return isValidParentChild(targetType, childType) ? childType : null;
};

export const TasksListPage: React.FC<TasksListPageProps> = ({ projectId, showBacklogOnly = false }) => {
  const navigate = useNavigate();
  const {
    tasks, projects, users, teams, deleteTask, reorderTasks, moveTask,
    bulkSelectedTaskIds, toggleBulkSelect, selectAllTasks, clearBulkSelection,
    bulkUpdateStatus, bulkUpdatePriority, bulkAssignUser, bulkAssignTeam,
    bulkMoveSprint, bulkDeleteTasks, sprints
  } = useAppStore();
  const { currentUser } = useAuthStore();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EPIC' | 'TASK' | 'SUB-TASK'>('ALL');
  const [epicFilter, setEpicFilter] = useState<string | 'ALL'>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'ALL'>('ALL');
  const [teamFilter, setTeamFilter] = useState<string | 'ALL'>('ALL');
  const [dueDateFilter, setDueDateFilter] = useState<'ALL' | 'OVERDUE' | 'TODAY' | 'WEEK' | 'NONE'>('ALL');

  // Expand / Collapse state (Set of expanded task/epic IDs)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'EPIC' | 'TASK' | 'SUB-TASK'>('TASK');
  const [createModalParentId, setCreateModalParentId] = useState<string>('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Bulk action states
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'priority' | 'assign' | 'sprint' | 'delete' | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  // Drag & Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // Filter tasks by project if scoped
  const baseTasks = useMemo(() => {
    let list = projectId ? tasks.filter((t) => t.projectId === projectId) : tasks;
    // MEMBER scope: the organization-wide Work Queue only contains work
    // assigned to the member (or to their team) — never other people's work.
    if (!projectId && currentUser?.role === 'MEMBER') {
      list = list.filter(
        (t) => t.assigneeId === currentUser.id || (!!currentUser.teamId && t.teamId === currentUser.teamId)
      );
    }
    if (showBacklogOnly) {
      list = list.filter((t) => !t.sprintId);
    }
    return list;
  }, [tasks, projectId, showBacklogOnly, currentUser]);

  // Maps for fast lookups
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Available epics for filter dropdown
  const availableEpics = useMemo(() => {
    return baseTasks.filter((t) => t.type === 'EPIC');
  }, [baseTasks]);

  // Initialize all Epics and Tasks as expanded on first load
  useEffect(() => {
    const initialExpanded = new Set<string>();
    baseTasks.forEach((t) => {
      if (t.type === 'EPIC' || t.type === 'TASK' || t.type === 'FEATURE') {
        initialExpanded.add(t.id);
      }
    });
    setExpandedIds(initialExpanded);
  }, [projectId]);

  // Toggle expand for a specific row
  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Check if a single item directly matches the active filters
  const doesItemMatchFilters = (item: Task): boolean => {
    // Search match
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      const assigneeName = item.assigneeId ? userMap.get(item.assigneeId)?.name.toLowerCase() : '';
      const assigneeMatch = assigneeName ? assigneeName.includes(q) : false;
      if (!titleMatch && !descMatch && !assigneeMatch) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

    // Priority filter
    if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;

    // Type filter
    if (typeFilter !== 'ALL') {
      const norm = String(item.type).toUpperCase().replace('_', '-');
      if (typeFilter === 'EPIC' && norm !== 'EPIC') return false;
      if (typeFilter === 'SUB-TASK' && norm !== 'SUB-TASK' && norm !== 'SUBTASK') return false;
      if (typeFilter === 'TASK' && norm !== 'TASK' && norm !== 'FEATURE' && norm !== 'BUG-FIX') return false;
    }

    // Assignee filter
    if (assigneeFilter !== 'ALL' && item.assigneeId !== assigneeFilter) return false;

    // Team filter
    if (teamFilter !== 'ALL' && item.teamId !== teamFilter) return false;

    // Due date filter
    if (dueDateFilter !== 'ALL') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDateFilter === 'OVERDUE') {
        if (!item.dueDate || new Date(item.dueDate) >= today || item.status === 'DONE') return false;
      } else if (dueDateFilter === 'TODAY') {
        if (!item.dueDate) return false;
        const due = new Date(item.dueDate);
        if (due.toDateString() !== today.toDateString()) return false;
      } else if (dueDateFilter === 'WEEK') {
        if (!item.dueDate) return false;
        const due = new Date(item.dueDate);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        if (due > weekFromNow || due < today) return false;
      } else if (dueDateFilter === 'NONE') {
        if (item.dueDate) return false;
      }
    }

    return true;
  };

  // Group items by hierarchy
  const hierarchyData = useMemo(() => {
    const allEpics = baseTasks.filter((t) => t.type === 'EPIC');
    const epicIds = new Set(allEpics.map((e) => e.id));

    // Tasks whose parent is an Epic
    const tasksByEpicId = new Map<string, Task[]>();
    // Sub-tasks whose parent is a Task
    const subTasksByTaskId = new Map<string, Task[]>();
    // Standalone tasks (no parent, or parent isn't an epic)
    const standaloneTasks: Task[] = [];
    // Standalone sub-tasks (if parent task missing)
    const orphanSubtasks: Task[] = [];

    const taskMap = new Map(baseTasks.map((t) => [t.id, t]));

    baseTasks.forEach((t) => {
      const norm = String(t.type).toUpperCase().replace('_', '-');
      if (norm === 'EPIC') return;

      if (norm === 'SUB-TASK' || norm === 'SUBTASK') {
        if (t.parentId && taskMap.has(t.parentId)) {
          const list = subTasksByTaskId.get(t.parentId) || [];
          list.push(t);
          subTasksByTaskId.set(t.parentId, list);
        } else {
          orphanSubtasks.push(t);
        }
      } else {
        // Standard Task / Feature / Bug
        if (t.parentId && epicIds.has(t.parentId)) {
          const list = tasksByEpicId.get(t.parentId) || [];
          list.push(t);
          tasksByEpicId.set(t.parentId, list);
        } else {
          standaloneTasks.push(t);
        }
      }
    });

    return {
      allEpics,
      tasksByEpicId,
      subTasksByTaskId,
      standaloneTasks,
      orphanSubtasks,
    };
  }, [baseTasks]);

  // Filtered tree generation
  const filteredHierarchy = useMemo(() => {
    const { allEpics, tasksByEpicId, subTasksByTaskId, standaloneTasks } = hierarchyData;

    // Filter by Epic dropdown if selected
    const selectedEpics =
      epicFilter === 'ALL' ? allEpics : allEpics.filter((e) => e.id === epicFilter);

    // Build visible tree elements
    const visibleEpics = selectedEpics.map((epic) => {
      const epicTasks = tasksByEpicId.get(epic.id) || [];
      const matchingTasks = epicTasks.map((task) => {
        const subtasks = subTasksByTaskId.get(task.id) || [];
        const matchingSubtasks = subtasks.filter(doesItemMatchFilters);
        const taskMatches = doesItemMatchFilters(task);

        return {
          task,
          subtasks,
          matchingSubtasks,
          isTaskOrSubtaskMatch: taskMatches || matchingSubtasks.length > 0,
        };
      });

      const hasMatchingChildTasks = matchingTasks.some((t) => t.isTaskOrSubtaskMatch);
      const epicMatches = doesItemMatchFilters(epic);

      return {
        epic,
        tasks: matchingTasks,
        isEpicOrChildMatch: epicMatches || hasMatchingChildTasks,
      };
    });

    // Standalone tasks filter
    const visibleStandaloneTasks = (epicFilter === 'ALL' ? standaloneTasks : []).map((task) => {
      const subtasks = hierarchyData.subTasksByTaskId.get(task.id) || [];
      const matchingSubtasks = subtasks.filter(doesItemMatchFilters);
      const taskMatches = doesItemMatchFilters(task);

      return {
        task,
        subtasks,
        matchingSubtasks,
        isTaskOrSubtaskMatch: taskMatches || matchingSubtasks.length > 0,
      };
    });

    return {
      visibleEpics: visibleEpics.filter((e) => e.isEpicOrChildMatch),
      visibleStandaloneTasks: visibleStandaloneTasks.filter((t) => t.isTaskOrSubtaskMatch),
    };
  }, [hierarchyData, doesItemMatchFilters, epicFilter]);

  // Handlers for Add / Edit / Delete / Move
  const handleOpenAddModal = (type: 'EPIC' | 'TASK' | 'SUB-TASK' = 'TASK', parentId = '') => {
    setCreateModalType(type);
    setCreateModalParentId(parentId);
    setIsCreateModalOpen(true);
  };

  const handleAddChild = (parentTask: Task) => {
    const norm = String(parentTask.type).toUpperCase().replace('_', '-');
    if (norm === 'EPIC') {
      handleOpenAddModal('TASK', parentTask.id);
    } else {
      handleOpenAddModal('SUB-TASK', parentTask.id);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setDeletingTask(task);
    setIsDeleteModalOpen(true);
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    const { updated, refused } = bulkUpdateStatus(status);
    if (updated > 0) {
      toast.success(`${updated} task${updated === 1 ? '' : 's'} updated to ${getStatusLabel(status)}`);
    }
    if (refused > 0) {
      toast.error(
        `${refused} Initiative${refused === 1 ? '' : 's'} could not move to ${getStatusLabel(status)} — Initiatives advance one step at a time through their workflow.`
      );
    }
    setBulkActionType(null);
  };

  const handleBulkPriorityChange = (priority: Priority) => {
    bulkUpdatePriority(priority);
    toast.success(`${bulkSelectedTaskIds.length} tasks updated to ${priority} priority`);
    setBulkActionType(null);
  };

  const handleBulkAssignUser = (userId: string) => {
    bulkAssignUser(userId);
    toast.success(`${bulkSelectedTaskIds.length} tasks reassigned`);
    setBulkActionType(null);
  };

  const handleBulkMoveSprint = (sprintId: string | undefined) => {
    bulkMoveSprint(sprintId);
    toast.success(`${bulkSelectedTaskIds.length} tasks moved to ${sprintId ? 'new iteration' : 'work queue'}`);
    setBulkActionType(null);
  };

  const handleBulkDelete = () => {
    setConfirmBulkDelete(true);
  };

  const confirmBulkDeleteAction = () => {
    bulkDeleteTasks();
    toast.success(`${bulkSelectedTaskIds.length} tasks deleted`);
    setBulkActionType(null);
    setConfirmBulkDelete(false);
  };

  const handleSelectAll = () => {
    const epicIds = filteredHierarchy.visibleEpics.flatMap(({ epic, tasks: epicTasks }) => {
      const ids = [epic.id];
      epicTasks.forEach(({ task, subtasks }) => {
        ids.push(task.id);
        subtasks.forEach((s) => ids.push(s.id));
      });
      return ids;
    });
    const standaloneIds = filteredHierarchy.visibleStandaloneTasks.flatMap(({ task, subtasks }) => {
      const ids = [task.id];
      subtasks.forEach((s) => ids.push(s.id));
      return ids;
    });
    const allVisibleIds = [...epicIds, ...standaloneIds];
    if (bulkSelectedTaskIds.length === allVisibleIds.length) {
      clearBulkSelection();
    } else {
      selectAllTasks(allVisibleIds);
    }
  };

  const handleOpenMoveModal = (task: Task) => {
    setMovingTask(task);
    setIsMoveModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingTask) return;
    deleteTask(deletingTask.id, true);
    toast.success(`${deletingTask.type} and its child items were deleted`);
    setIsDeleteModalOpen(false);
    setDeletingTask(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTargetId(null);
    setDragOverPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    // Prevent dragging a parent into its own children or itself
    if (isDescendantOrSelf(draggedTaskId, targetTask.id, tasks)) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;

    const dragged = tasks.find((t) => t.id === draggedTaskId);
    const canHaveChildren = !!dragged && resolveDropInsideType(targetTask.type, dragged.type) !== null;

    let position: 'before' | 'after' | 'inside';
    if (canHaveChildren) {
      if (relativeY < 0.25) {
        position = 'before';
      } else if (relativeY > 0.75) {
        position = 'after';
      } else {
        position = 'inside';
      }
    } else {
      position = relativeY < 0.5 ? 'before' : 'after';
    }

    setDragOverTargetId(targetTask.id);
    setDragOverPosition(position);
  };

  const handleDragLeave = (e: React.DragEvent, targetTask: Task) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      if (dragOverTargetId === targetTask.id) {
        setDragOverTargetId(null);
        setDragOverPosition(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    if (!draggedTaskId || draggedTaskId === targetTask.id || !dragOverPosition) {
      handleDragEnd();
      return;
    }

    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask) {
      handleDragEnd();
      return;
    }

    if (isDescendantOrSelf(draggedTaskId, targetTask.id, tasks)) {
      toast.error('Cannot move a work item into its own descendants');
      handleDragEnd();
      return;
    }

    if (dragOverPosition === 'inside') {
      // Enforce Initiative > Feature > Epic > Story/Task/Bug > Sub-task.
      const childType = resolveDropInsideType(targetTask.type, draggedTask.type);
      if (!childType) {
        toast.error(
          `A ${getWorkItemLabel(draggedTask.type)} cannot be placed under a ${getWorkItemLabel(targetTask.type)}`
        );
        handleDragEnd();
        return;
      }

      moveTask(
        draggedTask.id,
        {
          parentId: targetTask.id,
          projectId: targetTask.projectId,
          type: childType,
        },
        currentUser?.id
      );
      reorderTasks(draggedTask.id, targetTask.id, 'after');
      setExpandedIds((prev) => new Set(prev).add(targetTask.id));
      toast.success(
        childType === 'SUB-TASK'
          ? `Moved "${draggedTask.title}" as sub-task of "${targetTask.title}"`
          : `Moved "${draggedTask.title}" under ${getWorkItemLabel(targetTask.type)} "${targetTask.title}"`
      );
    } else {
      // Reorder before or after - the item keeps the target's parent.
      const newParent = targetTask.parentId
        ? tasks.find((t) => t.id === targetTask.parentId)
        : undefined;
      const allowed = newParent
        ? isValidParentChild(newParent.type, draggedTask.type)
        : ROOT_CREATABLE_TYPES.includes(draggedTask.type);

      if (!allowed) {
        toast.error(
          newParent
            ? `A ${getWorkItemLabel(draggedTask.type)} cannot be placed under a ${getWorkItemLabel(newParent.type)}`
            : `A ${getWorkItemLabel(draggedTask.type)} cannot live at the top level of the hierarchy`
        );
        handleDragEnd();
        return;
      }

      moveTask(
        draggedTask.id,
        {
          parentId: targetTask.parentId,
          projectId: targetTask.projectId,
        },
        currentUser?.id
      );
      reorderTasks(draggedTask.id, targetTask.id, dragOverPosition);
      toast.success(`Moved "${draggedTask.title}" ${dragOverPosition} "${targetTask.title}"`);
    }

    handleDragEnd();
  };

  const totalVisibleCount =
    filteredHierarchy.visibleEpics.length +
    filteredHierarchy.visibleEpics.reduce(
      (acc, e) =>
        acc +
        e.tasks.length +
        e.tasks.reduce((subAcc, t) => subAcc + t.matchingSubtasks.length, 0),
      0
    ) +
    filteredHierarchy.visibleStandaloneTasks.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search, Filter Bar & Actions */}
      <div className="card p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-wrap bg-white shadow-xs rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search epics, tasks, sub-tasks, assignees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 text-xs py-2 w-full"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="select text-xs w-auto py-2"
          >
            <option value="ALL">All Types</option>
            <option value="EPIC">⚡ Epics</option>
            <option value="TASK">✓ Tasks</option>
            <option value="SUB-TASK">↳ Sub-tasks</option>
          </select>

          {/* Parent Epic Filter */}
          {availableEpics.length > 0 && (
            <select
              value={epicFilter}
              onChange={(e) => setEpicFilter(e.target.value)}
              className="select text-xs w-auto py-2 max-w-[180px]"
            >
              <option value="ALL">All Epics</option>
              {availableEpics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.title}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
            className="select text-xs w-auto py-2"
          >
            <option value="ALL">All Statuses</option>
            {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'BUG_FIX', 'RETEST', 'BLOCKED', 'DONE'] as const).map((s) => (
              <option key={s} value={s}>
                {getStatusLabel(s)}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'ALL')}
            className="select text-xs w-auto py-2"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="select text-xs w-auto py-2 max-w-[160px]"
          >
            <option value="ALL">All Assignees</option>
            {users.filter((u) => baseTasks.some((t) => t.assigneeId === u.id)).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="select text-xs w-auto py-2 max-w-[160px]"
          >
            <option value="ALL">All Teams</option>
            {teams.filter((t) => baseTasks.some((task) => task.teamId === t.id)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Due Date Filter */}
          <select
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value as typeof dueDateFilter)}
            className="select text-xs w-auto py-2"
          >
            <option value="ALL">All Due Dates</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Due Today</option>
            <option value="WEEK">Due This Week</option>
            <option value="NONE">No Due Date</option>
          </select>

          {/* Clear Filters */}
          {(search || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || typeFilter !== 'ALL' || epicFilter !== 'ALL' || assigneeFilter !== 'ALL' || teamFilter !== 'ALL' || dueDateFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setTypeFilter('ALL');
                setEpicFilter('ALL');
                setAssigneeFilter('ALL');
                setTeamFilter('ALL');
                setDueDateFilter('ALL');
              }}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Right Actions: Add Task Button */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => handleOpenAddModal('TASK')}
            className="btn-primary btn-sm flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {bulkSelectedTaskIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-800">
              {bulkSelectedTaskIds.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              onChange={(e) => {
                if (e.target.value) handleBulkStatusChange(e.target.value as TaskStatus);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="" disabled>Change Status</option>
              {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'BUG_FIX', 'RETEST', 'BLOCKED', 'DONE'] as const).map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
            <select
              onChange={(e) => {
                if (e.target.value) handleBulkPriorityChange(e.target.value as Priority);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="" disabled>Change Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select
              onChange={(e) => {
                handleBulkMoveSprint(e.target.value === 'backlog' ? undefined : e.target.value || undefined);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="" disabled>Move to Iteration</option>
              <option value="backlog">Work Queue</option>
              {sprints.filter((s) => s.status !== 'COMPLETED').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              onChange={(e) => {
                if (e.target.value) handleBulkAssignUser(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white max-w-[140px]"
            >
              <option value="" disabled>Assign To</option>
              {users.filter((u) => u.status === 'ACTIVE').map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
          <button
            onClick={clearBulkSelection}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* Interactive Helper Banner */}
      <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-2xs">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-[#0b57d0] flex-shrink-0" />
          <span>
            <strong className="text-[#0b57d0]">Movable Tasks:</strong> Drag using the grip handle to reorder or drop inside an Epic/Task to nest it. Or click the <FolderInput className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> icon to move between iterations, projects, or statuses.
          </span>
        </div>
      </div>

      {/* Hierarchical Task Table */}
      <div className="card bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {totalVisibleCount === 0 ? (
          <EmptyState
            title="No tasks found"
            description="Try adjusting your search, filters, or create an Epic or Task to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={bulkSelectedTaskIds.length > 0 && bulkSelectedTaskIds.length === filteredHierarchy.visibleEpics.flatMap(({ epic, tasks: epicTasks }) => {
                        const ids = [epic.id];
                        epicTasks.forEach(({ task, subtasks }) => { ids.push(task.id); subtasks.forEach((s) => ids.push(s.id)); });
                        return ids;
                      }).length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 min-w-[280px]">Work Item & Hierarchy</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {/* 1. Render Epics and their descendant Tasks and Sub-tasks */}
                {filteredHierarchy.visibleEpics.map(({ epic, tasks: epicTasks }) => {
                  const isEpicExpanded = expandedIds.has(epic.id);

                  // Calculate Epic child stats
                  const epicTotalTasks = epicTasks.length;
                  const epicCompletedTasks = epicTasks.filter(
                    (t) => t.task.status === 'DONE'
                  ).length;

                  return (
                    <React.Fragment key={epic.id}>
                      {/* Epic Row (Level 0) */}
                      <TaskRow
                        task={epic}
                        level={0}
                        hasChildren={epicTasks.length > 0}
                        isExpanded={isEpicExpanded}
                        project={projectMap.get(epic.projectId)}
                        team={epic.teamId ? teamMap.get(epic.teamId) : undefined}
                        assignee={epic.assigneeId ? userMap.get(epic.assigneeId) : undefined}
                        childStats={{ total: epicTotalTasks, completed: epicCompletedTasks }}
                        isSelected={bulkSelectedTaskIds.includes(epic.id)}
                        onToggleExpand={() => handleToggleExpand(epic.id)}
                        onToggleSelect={() => toggleBulkSelect(epic.id)}
                        onAddChild={handleAddChild}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onMove={handleOpenMoveModal}
                        onClick={(id) => navigate(issuePath(id))}
                        isDragging={draggedTaskId === epic.id}
                        dropPosition={dragOverTargetId === epic.id ? dragOverPosition : null}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      />

                      {/* Tasks under this Epic (Level 1) */}
                      {isEpicExpanded &&
                        epicTasks.map(({ task, subtasks, matchingSubtasks }) => {
                          const isTaskExpanded = expandedIds.has(task.id);
                          const taskTotalSubtasks = subtasks.length;
                          const taskCompletedSubtasks = subtasks.filter(
                            (s) => s.status === 'DONE'
                          ).length;

                          return (
                            <React.Fragment key={task.id}>
                              <TaskRow
                                task={task}
                                level={1}
                                hasChildren={subtasks.length > 0}
                                isExpanded={isTaskExpanded}
                                project={projectMap.get(task.projectId)}
                                team={task.teamId ? teamMap.get(task.teamId) : undefined}
                                assignee={
                                  task.assigneeId ? userMap.get(task.assigneeId) : undefined
                                }
                                childStats={{
                                  total: taskTotalSubtasks,
                                  completed: taskCompletedSubtasks,
                                }}
                                isSelected={bulkSelectedTaskIds.includes(task.id)}
                                onToggleExpand={() => handleToggleExpand(task.id)}
                                onToggleSelect={() => toggleBulkSelect(task.id)}
                                onAddChild={handleAddChild}
                                onEdit={handleEditTask}
                                onDelete={handleDeleteTask}
                                onMove={handleOpenMoveModal}
                                onClick={(id) => navigate(issuePath(id))}
                                isDragging={draggedTaskId === task.id}
                                dropPosition={dragOverTargetId === task.id ? dragOverPosition : null}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                              />

                              {/* Sub-tasks under this Task (Level 2) */}
                              {isTaskExpanded &&
                                matchingSubtasks.map((subtask) => (
                                  <TaskRow
                                    key={subtask.id}
                                    task={subtask}
                                    level={2}
                                    hasChildren={false}
                                    isExpanded={false}
                                    project={projectMap.get(subtask.projectId)}
                                    team={
                                      subtask.teamId
                                        ? teamMap.get(subtask.teamId)
                                        : undefined
                                    }
                                    assignee={
                                      subtask.assigneeId
                                        ? userMap.get(subtask.assigneeId)
                                        : undefined
                                    }
                                    isSelected={bulkSelectedTaskIds.includes(subtask.id)}
                                    onToggleSelect={() => toggleBulkSelect(subtask.id)}
                                    onToggleExpand={() => {}}
                                    onAddChild={() => {}}
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
                                    onMove={handleOpenMoveModal}
                                    onClick={(id) => navigate(issuePath(id))}
                                    isDragging={draggedTaskId === subtask.id}
                                    dropPosition={dragOverTargetId === subtask.id ? dragOverPosition : null}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                  />
                                ))}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}

                {/* 2. Render Standalone Tasks & their Subtasks */}
                {filteredHierarchy.visibleStandaloneTasks.map(
                  ({ task, subtasks, matchingSubtasks }) => {
                    const isTaskExpanded = expandedIds.has(task.id);
                    const taskTotalSubtasks = subtasks.length;
                    const taskCompletedSubtasks = subtasks.filter(
                      (s) => s.status === 'DONE'
                    ).length;

                    return (
                      <React.Fragment key={task.id}>
                        <TaskRow
                          task={task}
                          level={0}
                          hasChildren={subtasks.length > 0}
                          isExpanded={isTaskExpanded}
                          project={projectMap.get(task.projectId)}
                          team={task.teamId ? teamMap.get(task.teamId) : undefined}
                          assignee={
                            task.assigneeId ? userMap.get(task.assigneeId) : undefined
                          }
                          childStats={{
                            total: taskTotalSubtasks,
                            completed: taskCompletedSubtasks,
                          }}
                          isSelected={bulkSelectedTaskIds.includes(task.id)}
                          onToggleExpand={() => handleToggleExpand(task.id)}
                          onToggleSelect={() => toggleBulkSelect(task.id)}
                          onAddChild={handleAddChild}
                          onEdit={handleEditTask}
                          onDelete={handleDeleteTask}
                          onMove={handleOpenMoveModal}
                          onClick={(id) => navigate(issuePath(id))}
                          isDragging={draggedTaskId === task.id}
                          dropPosition={dragOverTargetId === task.id ? dragOverPosition : null}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        />

                        {/* Sub-tasks under Standalone Task */}
                        {isTaskExpanded &&
                          matchingSubtasks.map((subtask) => (
                            <TaskRow
                              key={subtask.id}
                              task={subtask}
                              level={1}
                              hasChildren={false}
                              isExpanded={false}
                              project={projectMap.get(subtask.projectId)}
                              team={
                                subtask.teamId ? teamMap.get(subtask.teamId) : undefined
                              }
                              assignee={
                                subtask.assigneeId
                                  ? userMap.get(subtask.assigneeId)
                                  : undefined
                              }
                              isSelected={bulkSelectedTaskIds.includes(subtask.id)}
                              onToggleSelect={() => toggleBulkSelect(subtask.id)}
                              onToggleExpand={() => {}}
                              onAddChild={() => {}}
                              onEdit={handleEditTask}
                              onDelete={handleDeleteTask}
                              onMove={handleOpenMoveModal}
                              onClick={(id) => navigate(issuePath(id))}
                              isDragging={draggedTaskId === subtask.id}
                              dropPosition={dragOverTargetId === subtask.id ? dragOverPosition : null}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                            />
                          ))}
                      </React.Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Work Item Modal */}
      <CreateWorkItemModal
        isOpen={isCreateModalOpen}
        projectId={projectId}
        initialType={createModalType}
        initialParentId={createModalParentId}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={isEditModalOpen}
        task={editingTask}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
      />

      {/* Move Task Modal */}
      <MoveTaskModal
        isOpen={isMoveModalOpen}
        task={movingTask}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingTask(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteTaskModal
        isOpen={isDeleteModalOpen}
        task={deletingTask}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingTask(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={confirmBulkDeleteAction}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${bulkSelectedTaskIds.length} selected tasks? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
};
