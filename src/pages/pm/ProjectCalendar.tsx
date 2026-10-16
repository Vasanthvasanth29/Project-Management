import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Plus, X, Clock, AlertCircle, CheckCircle2, User as UserIcon, Tag,
  Filter, CalendarDays, ArrowRight, Flag, MoreHorizontal, UserCheck,
  Sparkles, RotateCcw, Search, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { formatDate } from '../../utils/dateUtils';
import { isCancelledWorkItem, displayStatusLabel } from '../../utils/roleUtils';
import type { Task, TaskStatus, Priority } from '../../types';

interface ProjectCalendarProps {
  projectId: string;
}

const statusColors: Record<TaskStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  TODO: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400', label: 'To Do' },
  IN_PROGRESS: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'In Progress' },
  IN_REVIEW: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'In Review' },
  TESTING: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', label: 'Testing' },
  BUG_FIX: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'Bug Fix' },
  RETEST: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Retest' },
  BLOCKED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Blocked' },
  DONE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Done' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', label: 'Cancelled' },
  BACKLOG: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400', label: 'Backlog' },
  ASSESSMENT: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'Assessment' },
  ON_BOARD: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', label: 'On Board' },
  READY_FOR_DEVELOPMENT: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Ready for Development' },
  IN_DEVELOPMENT: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', label: 'In Development' },
  ON_HOLD: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'On Hold' },
  DEVELOPMENT_COMPLETE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Development Complete' },
  READY_FOR_DEPLOYMENT: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', label: 'Ready for Deployment' },
  DEPLOYMENT: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'Deployment' },
  VALIDATION: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Validation' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Completed' },
};

const priorityColors: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-600', label: 'Low' },
  MEDIUM: { bg: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-600', label: 'Medium' },
  HIGH: { bg: 'bg-orange-100 text-orange-800', text: 'text-orange-600', label: 'High' },
  CRITICAL: { bg: 'bg-red-100 text-red-800', text: 'text-red-600', label: 'Critical' },
};

// DONE + CANCELLED resolution renders as Cancelled, never as Done.
const CANCELLED_STATUS = {
  bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200',
  dot: 'bg-slate-400', label: 'Cancelled',
};
const statusStyleFor = (task: Task) =>
  isCancelledWorkItem(task) ? CANCELLED_STATUS : statusColors[task.status] || statusColors.TODO;

// Robust date key extraction
const getTaskDateKey = (task: Task): string | null => {
  const d = task.dueDate || task.startDate || task.createdAt;
  if (!d) return null;
  if (d.includes('T')) {
    return d.split('T')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

export const ProjectCalendar: React.FC<ProjectCalendarProps> = ({ projectId }) => {
  const { tasks, users, sprints, projects, createTask, updateTask, updateTaskStatus, assignTask } = useAppStore();
  const { currentUser } = useAuthStore();

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useMemo(() => {
    return tasks.filter((t) => t.projectId === projectId);
  }, [tasks, projectId]);

  const projectSprints = useMemo(() => {
    return sprints.filter((s) => s.projectId === projectId);
  }, [sprints, projectId]);

  const projectUsers = useMemo(() => {
    return users;
  }, [users]);

  // Find all distinct months where this project has tasks
  const monthsWithTasks = useMemo(() => {
    const map = new Map<string, number>();
    projectTasks.forEach((t) => {
      const key = getTaskDateKey(t);
      if (key) {
        const ym = key.slice(0, 7); // YYYY-MM
        map.set(ym, (map.get(ym) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([ym, count]) => {
        const [y, m] = ym.split('-').map(Number);
        return { ym, year: y, month: m - 1, count };
      })
      .sort((a, b) => b.ym.localeCompare(a.ym));
  }, [projectTasks]);

  // Initialize currentDate to latest month with tasks, or current date
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date();
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form State for Add Task
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('MEDIUM');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('TODO');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskSprintId, setNewTaskSprintId] = useState('');
  const [newTaskType, setNewTaskType] = useState<Task['type']>('TASK');

  // Calendar Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Navigation handlers
  const handlePrevYear = () => {
    setCurrentDate(new Date(year - 1, month, 1));
  };

  const handleNextYear = () => {
    setCurrentDate(new Date(year + 1, month, 1));
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleYearChange = (newYear: number) => {
    setCurrentDate(new Date(newYear, month, 1));
  };

  const handleMonthChange = (newMonth: number) => {
    setCurrentDate(new Date(year, newMonth, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleJumpToMonthYear = (targetYear: number, targetMonth: number) => {
    setCurrentDate(new Date(targetYear, targetMonth, 1));
  };

  // Generate Year Range (15 years back to 10 years ahead)
  const currentActualYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentActualYear - 15; y <= currentActualYear + 10; y++) {
      years.push(y);
    }
    return years;
  }, [currentActualYear]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((task) => {
      if (filterStatus !== 'ALL' && task.status !== filterStatus) return false;
      if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
      if (filterAssignee === 'UNASSIGNED' && task.assigneeId) return false;
      if (filterAssignee === 'ME' && task.assigneeId !== currentUser?.id) return false;
      if (filterAssignee !== 'ALL' && filterAssignee !== 'UNASSIGNED' && filterAssignee !== 'ME' && task.assigneeId !== filterAssignee) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [projectTasks, filterStatus, filterPriority, filterAssignee, searchQuery, currentUser]);

  // Map tasks by YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filteredTasks.forEach((t) => {
      const dateKey = getTaskDateKey(t);
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(t);
      }
    });
    return map;
  }, [filteredTasks]);

  // Open Add Task Modal for specific date
  const handleOpenAddOnDate = (dateStr: string) => {
    setNewTaskDueDate(dateStr);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('MEDIUM');
    setNewTaskStatus('TODO');
    setNewTaskAssigneeId('');
    setNewTaskSprintId('');
    setNewTaskType('TASK');
    setIsAddModalOpen(true);
  };

  // Submit Add Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    createTask({
      projectId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : new Date().toISOString(),
      priority: newTaskPriority,
      status: newTaskStatus,
      type: newTaskType,
      assigneeId: newTaskAssigneeId || undefined,
      sprintId: newTaskSprintId || undefined,
      createdById: currentUser?.id || 'admin',
    });

    toast.success(`Task "${newTaskTitle.trim()}" added to calendar!`);
    setIsAddModalOpen(false);
  };

  // Handle status update inside task details
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    if (currentUser) {
      const res = updateTaskStatus(taskId, newStatus, currentUser.id);
      if (!res.ok) {
        toast.error(res.reason || 'That move is not allowed.');
        return;
      }
      // Cancelled is a real status: never carry a stale resolution with it.
      if (newStatus === 'CANCELLED') {
        updateTask(taskId, { resolution: undefined, resolvedAt: undefined, completedAt: undefined });
      }
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus });
      }
      toast.success(`Task status updated to ${statusColors[newStatus]?.label || newStatus}`);
    }
  };

  // Handle assignee change inside task details
  const handleAssigneeChange = (taskId: string, newAssigneeId: string) => {
    if (currentUser) {
      assignTask(taskId, newAssigneeId || '', currentUser.id);
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, assigneeId: newAssigneeId || undefined });
      }
      const user = users.find((u) => u.id === newAssigneeId);
      toast.success(user ? `Task assigned to ${user.name}` : 'Task unassigned');
    }
  };

  // Handle due date change inside task details
  const handleDueDateChange = (taskId: string, newDueDate: string) => {
    const formatted = newDueDate ? new Date(newDueDate).toISOString() : undefined;
    updateTask(taskId, { dueDate: formatted });
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, dueDate: formatted });
    }
    toast.success('Due date updated');
  };

  // Build Calendar Matrix
  const calendarCells = useMemo(() => {
    const cells = [];

    // Previous month filler days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        date: prevDate,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // Current month days
    const today = new Date();
    const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = isThisMonth && today.getDate() === d;
      cells.push({
        dayNumber: d,
        date,
        dateStr,
        isCurrentMonth: true,
        isToday,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // Next month filler days to complete grid (42 cells = 6 weeks)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        date: nextDate,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    return cells;
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth, tasksByDate]);

  const tasksInCurrentViewCount = useMemo(() => {
    return calendarCells.filter((c) => c.isCurrentMonth).reduce((acc, c) => acc + c.tasks.length, 0);
  }, [calendarCells]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Calendar Header with Standalone Today Button & Movable Month / Year */}
      <div className="card p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Navigation Area */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Standalone Today Button */}
            <button
              type="button"
              onClick={handleToday}
              className="btn-secondary btn-sm flex items-center gap-1.5 font-semibold text-slate-800 hover:text-brand-700 hover:border-brand-300 shadow-xs active:scale-95"
              title="Go to Today"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-brand-600" />
              <span>Today</span>
            </button>

            {/* Month Stepper & Dropdown */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={month}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none cursor-pointer"
              >
                {monthNames.map((mName, mIdx) => (
                  <option key={mName} value={mIdx}>
                    {mName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Year Stepper & Dropdown */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={handlePrevYear}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Previous Year (-1 Year)"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <select
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNextYear}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="Next Year (+1 Year)"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Add Task Button */}
          <button
            type="button"
            onClick={() => handleOpenAddOnDate(new Date().toISOString().split('T')[0])}
            className="btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>

        {/* Quick Jump to Months with Assigned Tasks */}
        {monthsWithTasks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Jump to assigned tasks:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {monthsWithTasks.slice(0, 5).map((item) => {
                const isCurrentView = item.year === year && item.month === month;
                return (
                  <button
                    key={item.ym}
                    type="button"
                    onClick={() => handleJumpToMonthYear(item.year, item.month)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${isCurrentView
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 border border-slate-200'
                      }`}
                  >
                    <span>{monthNames[item.month].slice(0, 3)} {item.year}</span>
                    <span className={`px-1 rounded-full text-[9px] ${isCurrentView ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[160px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Assignee Filter */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Assignees</option>
              <option value="ME">Assigned to Me</option>
              <option value="UNASSIGNED">Unassigned</option>
              {projectUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="TESTING">Testing</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{tasksInCurrentViewCount}</span> task{tasksInCurrentViewCount !== 1 ? 's' : ''} in {monthNames[month]} {year}
          </div>
        </div>
      </div>

      {/* Calendar Grid with Hover Day Highlight */}
      <div className="card overflow-hidden border border-slate-200 shadow-sm bg-white">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center text-xs font-semibold text-slate-600 py-2.5">
          {daysOfWeek.map((day, idx) => (
            <div key={day} className={idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-700'}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            return (
              <div
                key={idx}
                className={`min-h-[120px] p-2 flex flex-col justify-between transition-all duration-150 relative group cursor-pointer ${!cell.isCurrentMonth
                    ? 'bg-slate-50/40 text-slate-400 hover:bg-slate-100/70 hover:shadow-xs'
                    : cell.isToday
                      ? 'bg-brand-50/30 hover:bg-brand-50/70 hover:ring-2 hover:ring-brand-400 hover:shadow-md hover:z-10'
                      : 'bg-white hover:bg-brand-50/30 hover:ring-2 hover:ring-brand-400 hover:shadow-md hover:z-10'
                  }`}
              >
                {/* Cell Header: Date Number & Quick Add Button */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${cell.isToday
                        ? 'bg-brand-600 text-white font-bold shadow-xs'
                        : cell.isCurrentMonth
                          ? 'text-slate-800 group-hover:text-brand-700 group-hover:font-bold'
                          : 'text-slate-400'
                      }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Quick Add Task on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddOnDate(cell.dateStr);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-brand-100 text-brand-600 transition-all"
                    title={`Add task on ${cell.dateStr}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tasks List inside Date Cell */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                  {cell.tasks.slice(0, 3).map((task) => {
                    const statusStyle = statusStyleFor(task);
                    const assignee = users.find((u) => u.id === task.assigneeId);

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        className={`text-[11px] p-1.5 rounded-lg border cursor-pointer hover:shadow-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between gap-1.5 ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}
                        title={`${task.title} (${displayStatusLabel(task)}) - ${assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
                          <span className="font-medium truncate">{task.title}</span>
                        </div>
                        {assignee && (
                          <div className="flex-shrink-0" title={`Assigned to ${assignee.name}`}>
                            <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {cell.tasks.length > 3 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddOnDate(cell.dateStr);
                      }}
                      className="text-[10px] text-center text-brand-600 font-semibold cursor-pointer hover:underline pt-0.5"
                    >
                      +{cell.tasks.length - 3} more tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Details Modal (With Assignee Selector, Status Updater, and Due Date change) */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="card bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge badge-gray text-[10px] uppercase font-bold">{selectedTask.type}</span>
                  <span className={`badge text-[10px] font-semibold ${priorityColors[selectedTask.priority]?.bg || 'bg-slate-100'}`}>
                    {selectedTask.priority} Priority
                  </span>
                  <span className={`badge text-[10px] font-semibold ${statusStyleFor(selectedTask).bg} ${statusStyleFor(selectedTask).text}`}>
                    {statusStyleFor(selectedTask).label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{selectedTask.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4">
              {/* Description */}
              {selectedTask.description ? (
                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedTask.description}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No description provided.</div>
              )}

              {/* Task Details Metadata (Assignee Selector & Due Date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Assignee Selector */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-brand-600" />
                    <span>Assigned Member</span>
                  </label>
                  <select
                    value={selectedTask.assigneeId || ''}
                    onChange={(e) => handleAssigneeChange(selectedTask.id, e.target.value)}
                    className="input text-xs py-1.5 bg-white font-medium text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {projectUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date Changer */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-brand-600" />
                    <span>Calendar Due Date</span>
                  </label>
                  <input
                    type="date"
                    value={selectedTask.dueDate ? selectedTask.dueDate.split('T')[0] : (selectedTask.startDate ? selectedTask.startDate.split('T')[0] : '')}
                    onChange={(e) => handleDueDateChange(selectedTask.id, e.target.value)}
                    className="input text-xs py-1.5 bg-white font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Quick Status Updater */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-700">Update Status:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE', 'BLOCKED', 'CANCELLED'] as TaskStatus[]).map((st) => {
                    // A cancelled task sits in the DONE column but must not highlight "Done".
                    const isCurrent = selectedTask.status === st &&
                      !(st === 'DONE' && isCancelledWorkItem(selectedTask));
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(selectedTask.id, st)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${isCurrent
                            ? `${statusColors[st].bg} ${statusColors[st].text} ring-1 ${statusColors[st].border} font-bold shadow-xs`
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                      >
                        {statusColors[st].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-3.5 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="btn-primary btn-sm px-5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="card bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add & Assign New Task</h3>
                  <p className="text-xs text-slate-400">Schedule and assign a task on this project calendar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTask} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Implement user permissions"
                  className="input text-sm py-2"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Brief details about the task..."
                  className="input text-sm py-2 resize-none"
                />
              </div>

              {/* Date & Priority Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="input text-xs py-2"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    className="input text-xs py-2"
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
                {/* Assignee */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign To</label>
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="input text-xs py-2"
                  >
                    <option value="">Unassigned</option>
                    {projectUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="input text-xs py-2"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="TESTING">Testing</option>
                  </select>
                </div>
              </div>

              {/* Iteration & Type */}
              {projectSprints.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Iteration (Optional)</label>
                  <select
                    value={newTaskSprintId}
                    onChange={(e) => setNewTaskSprintId(e.target.value)}
                    className="input text-xs py-2"
                  >
                    <option value="">No Iteration (Work Queue)</option>
                    {projectSprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create & Assign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
