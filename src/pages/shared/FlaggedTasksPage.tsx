import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flag, Bookmark, Search, ArrowUpRight, CheckCircle2,
  AlertTriangle, Clock, Calendar, User as UserIcon, X, Plus,
  Layers, ChevronRight, Edit3, Trash2, Check, RefreshCw,
  FolderKanban, LayoutGrid, List, Tag, ShieldAlert, Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { PriorityBadge, StatusBadge } from '../../components/common/Badges';
import { TaskTypeBadge } from './tasks/TaskTypeBadge';
import { Avatar } from '../../components/common/Avatar';
import { issuePath } from '../../utils/issueUrl';
import { formatTimeAgo } from '../../utils/dateUtils';
import { toast } from 'sonner';
import type { Task, Priority, TaskStatus } from '../../types';

export const FlaggedTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, projects, users, toggleTaskFlag } = useAppStore();
  const { currentUser } = useAuthStore();

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'due' | 'title'>('recent');

  // Edit Flag Reason modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editReasonText, setEditReasonText] = useState('');

  // Quick Flag Add modal
  const [showAddFlagModal, setShowAddFlagModal] = useState(false);
  const [addSearchTaskQuery, setAddSearchTaskQuery] = useState('');
  const [addFlagReason, setAddFlagReason] = useState('');

  // All flagged tasks
  const flaggedTasks = useMemo(() => {
    return tasks.filter((t) => t.isFlagged);
  }, [tasks]);

  // Filtered flagged tasks
  const filteredTasks = useMemo(() => {
    return flaggedTasks
      .filter((t) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchId = t.id.toLowerCase().includes(q);
          const matchReason = t.flaggedReason?.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchId && !matchReason && !matchDesc) return false;
        }

        // Project filter
        if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) {
          return false;
        }

        // Priority filter
        if (selectedPriority !== 'all' && t.priority !== selectedPriority) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'all' && t.status !== selectedStatus) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          const timeA = a.flaggedAt ? new Date(a.flaggedAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
          const timeB = b.flaggedAt ? new Date(b.flaggedAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
          return timeB - timeA;
        }
        if (sortBy === 'priority') {
          const priorityWeights: Record<Priority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        }
        if (sortBy === 'due') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [flaggedTasks, searchQuery, selectedProjectId, selectedPriority, selectedStatus, sortBy]);

  // Summary Metrics
  const criticalCount = useMemo(() => flaggedTasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH').length, [flaggedTasks]);
  const blockedCount = useMemo(() => flaggedTasks.filter((t) => t.status === 'BLOCKED').length, [flaggedTasks]);
  const inProgressCount = useMemo(() => flaggedTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length, [flaggedTasks]);

  // Navigate to task detail page
  const handleOpenTask = (taskId: string) => {
    navigate(issuePath(taskId));
  };

  // Unflag / Remove bookmark
  const handleUnflag = (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleTaskFlag(task.id, false, undefined, currentUser?.id);
    toast.success(`Removed flag from "${task.title}"`);
  };

  // Open edit modal
  const handleOpenEditModal = (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setEditReasonText(task.flaggedReason || '');
  };

  // Save updated flag reason
  const handleSaveEditReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    toggleTaskFlag(editingTask.id, true, editReasonText.trim() || 'Impediment flagged / Bookmarked', currentUser?.id);
    toast.success('Updated bookmark reference note');
    setEditingTask(null);
  };

  // Unflagged tasks for quick bookmarking
  const unflaggedCandidates = useMemo(() => {
    if (!addSearchTaskQuery.trim()) return [];
    const q = addSearchTaskQuery.toLowerCase().trim();
    return tasks
      .filter((t) => !t.isFlagged)
      .filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [tasks, addSearchTaskQuery]);

  const handleQuickAddFlag = (task: Task) => {
    toggleTaskFlag(task.id, true, addFlagReason.trim() || 'Bookmarked for reference', currentUser?.id);
    toast.success(`Flagged "${task.title}"`);
    setShowAddFlagModal(false);
    setAddSearchTaskQuery('');
    setAddFlagReason('');
  };

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* Sleek Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#e2e5ea]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Flag className="w-3.5 h-3.5 fill-white" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-display">
              Flagged Tasks & Bookmarks
            </h1>
            <span className="px-2 py-0.2 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {flaggedTasks.length}
            </span>
          </div>

          {/* Inline Micro Stats */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              {criticalCount} Critical
            </span>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {blockedCount} Impeded
            </span>
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {inProgressCount} In Progress
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowAddFlagModal(true)}
          className="btn-primary btn-sm py-1 px-2.5 text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Flag New Task</span>
        </button>
      </div>

      {/* Sleek Single-Line Compact Toolbar */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[170px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flagged tasks..."
            className="w-full pl-8 pr-6 py-1 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 transition-all bg-slate-50/50 h-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50/50 text-xs h-8 py-0.5 px-2 text-slate-700 focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50/50 text-xs h-8 py-0.5 px-2 text-slate-700 focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50/50 text-xs h-8 py-0.5 px-2 text-slate-700 focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="TESTING">Testing</option>
          <option value="BLOCKED">Blocked</option>
          <option value="DONE">Done</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-slate-50/50 text-xs h-8 py-0.5 px-2 text-slate-700 focus:outline-none focus:border-teal-500"
        >
          <option value="recent">Recently Flagged</option>
          <option value="priority">Priority</option>
          <option value="due">Due Date</option>
          <option value="title">Title (A-Z)</option>
        </select>

        {/* View Toggle */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 ml-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'cards' ? 'bg-white shadow-xs text-teal-700' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Cards View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'table' ? 'bg-white shadow-xs text-teal-700' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Table View"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {filteredTasks.length === 0 ? (
        <div className="card p-8 text-center bg-white border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
            <Bookmark className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No flagged tasks found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5 mb-3">
            {searchQuery || selectedProjectId !== 'all' || selectedPriority !== 'all' || selectedStatus !== 'all'
              ? 'No bookmarked tasks match your current filters.'
              : 'You have not flagged or bookmarked any tasks yet.'}
          </p>
          {(searchQuery || selectedProjectId !== 'all' || selectedPriority !== 'all' || selectedStatus !== 'all') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedProjectId('all');
                setSelectedPriority('all');
                setSelectedStatus('all');
              }}
              className="btn-secondary btn-sm py-1 px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddFlagModal(true)}
              className="btn-primary btn-sm py-1 px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Flag a Task</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* COMPACT CARDS / BOOKMARKS GRID VIEW (2-3+ rows fit on screen) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {filteredTasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            const assignee = users.find((u) => u.id === task.assigneeId);

            return (
              <div
                key={task.id}
                onClick={() => handleOpenTask(task.id)}
                className="group relative bg-white rounded-xl p-3 border border-[#e2e5ea] hover:border-amber-400 hover:shadow-md transition-all duration-150 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Row 1: Badges & Actions */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {project && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[100px]">
                          {project.key || project.name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {task.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <PriorityBadge priority={task.priority} />
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(task, e)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit reference note"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleUnflag(task, e)}
                        className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                        title="Remove flag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Task Title */}
                  <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1 mb-1.5 leading-snug">
                    {task.title}
                  </h3>

                  {/* Flagged Reason / Reference Callout (Compact single line) */}
                  <div className="bg-amber-50 rounded-lg py-1 px-2 border border-amber-200/80 mb-2 flex items-center justify-between gap-1.5 text-[11px] text-amber-950">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Flag className="w-3 h-3 text-amber-600 fill-amber-500 flex-shrink-0" />
                      <span className="truncate font-medium" title={task.flaggedReason}>
                        {task.flaggedReason || 'Bookmarked reference'}
                      </span>
                    </div>
                    {task.flaggedAt && (
                      <span className="text-[10px] text-amber-700 flex-shrink-0 font-normal">
                        {formatTimeAgo(task.flaggedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <StatusBadge status={task.status} resolution={task.resolution} />
                    {task.type && <TaskTypeBadge type={task.type} />}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {assignee ? (
                      <div className="flex items-center gap-1" title={`Assignee: ${assignee.name}`}>
                        <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                        <span className="text-[10px] text-slate-600 truncate max-w-[65px]">
                          {assignee.name.split(' ')[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">Unassigned</span>
                    )}

                    <div className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-teal-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-all">
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card overflow-hidden bg-white border border-slate-200">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Task</th>
                  <th className="py-2.5 px-2.5">Project</th>
                  <th className="py-2.5 px-3">Reference / Flag Reason</th>
                  <th className="py-2.5 px-2.5">Priority</th>
                  <th className="py-2.5 px-2.5">Status</th>
                  <th className="py-2.5 px-2.5">Assignee</th>
                  <th className="py-2.5 px-2.5">Flagged</th>
                  <th className="py-2.5 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  const assignee = users.find((u) => u.id === task.assigneeId);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleOpenTask(task.id)}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Task Key & Title */}
                      <td className="py-2 px-3 max-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          <Flag className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-500 mr-1">
                              {task.id}
                            </span>
                            <span className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                              {task.title}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {project ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {project.key || project.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Flag Reason */}
                      <td className="py-2 px-3 max-w-[220px]">
                        <p className="text-xs text-amber-900 font-medium truncate" title={task.flaggedReason}>
                          {task.flaggedReason || 'Flagged reference'}
                        </p>
                      </td>

                      {/* Priority */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <PriorityBadge priority={task.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <StatusBadge status={task.status} resolution={task.resolution} />
                      </td>

                      {/* Assignee */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {assignee ? (
                          <div className="flex items-center gap-1">
                            <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                            <span className="text-slate-700 text-[11px]">{assignee.name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Unassigned</span>
                        )}
                      </td>

                      {/* Flagged Date */}
                      <td className="py-2 px-2.5 whitespace-nowrap text-slate-500 text-[10px]">
                        {task.flaggedAt ? formatTimeAgo(task.flaggedAt) : 'Recently'}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenTask(task.id)}
                            className="p-1 rounded bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-600 transition-colors"
                            title="Open Task"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(task, e)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleUnflag(task, e)}
                            className="p-1 rounded hover:bg-amber-100 text-amber-700 transition-colors"
                            title="Unflag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT FLAG NOTE MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-4 max-w-md w-full shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <h3 className="text-xs font-bold text-slate-900">Edit Bookmark / Flag Note</h3>
              </div>
              <button onClick={() => setEditingTask(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditReason} className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Task: <span className="font-bold text-slate-900">{editingTask.id} — {editingTask.title}</span>
                </label>
                <textarea
                  value={editReasonText}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  placeholder="Enter reference details, impediment blocker, or bookmark note..."
                  className="input h-20 resize-none text-xs p-2"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="btn-secondary btn-sm py-1 px-2.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-sm py-1 px-2.5 text-xs"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD FLAG / BOOKMARK MODAL */}
      {showAddFlagModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900">Bookmark / Flag a Task</h3>
              </div>
              <button onClick={() => setShowAddFlagModal(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Search unflagged task:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={addSearchTaskQuery}
                    onChange={(e) => setAddSearchTaskQuery(e.target.value)}
                    placeholder="Type task title or task ID (e.g. KEY-001)..."
                    className="input pl-8 text-xs h-8"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reference / Flag note (optional):
                </label>
                <input
                  type="text"
                  value={addFlagReason}
                  onChange={(e) => setAddFlagReason(e.target.value)}
                  placeholder="E.g. Bookmarked for Q4 iteration review / Waiting for API response"
                  className="input text-xs h-8"
                />
              </div>

              {/* Candidates list */}
              <div className="mt-1.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Task ({unflaggedCandidates.length} matches):
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                  {unflaggedCandidates.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      {addSearchTaskQuery ? 'No unflagged tasks found matching query' : 'Type above to search across tasks'}
                    </div>
                  ) : (
                    unflaggedCandidates.map((task) => {
                      const proj = projects.find((p) => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          onClick={() => handleQuickAddFlag(task)}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-all cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-mono font-bold text-slate-500">{task.id}</span>
                              {proj && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono">
                                  {proj.name}
                                </span>
                              )}
                              <PriorityBadge priority={task.priority} />
                            </div>
                            <div className="text-xs font-semibold text-slate-900 group-hover:text-teal-800 truncate">
                              {task.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-primary btn-sm py-0.5 px-2 text-[11px] flex-shrink-0"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Flag</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddFlagModal(false)}
                  className="btn-secondary btn-sm py-1 px-2.5 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
