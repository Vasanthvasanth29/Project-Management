import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, CalendarRange, CheckCircle2, Clock, Play, Flag, Target,
  GripVertical, ChevronDown, ChevronUp, CheckSquare,
  Sparkles, ArrowRight, Filter, AlertCircle, CheckCircle, ListTodo,
  User as UserIcon, Calendar, X, Check, ArrowUpRight, UserPlus, Users,
  MessageSquareHeart, Link2, GitBranch, AlertTriangle,
  BarChart3, FileText, TrendingDown, Zap, ListTree
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { ProgressBar } from '../../components/common/ProgressBar';
import { SprintStatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate, formatShortDate } from '../../utils/dateUtils';
import { matchId, getProjectUrl, toUrlId } from '../../utils/idUtils';
import { getIssueKeyPrefix } from '../../utils/projectIdentity';
import { issuePath } from '../../utils/issueUrl';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import type { Task, TaskStatus, Priority, Sprint } from '../../types';
import { toast } from 'sonner';
import { SprintCompletionModal } from './SprintCompletionModal';
import { SprintRetrospectiveModal } from './SprintRetrospectiveModal';
import { SprintLinkModal } from './SprintLinkModal';
import { CreateIterationModal } from './CreateIterationModal';
import { CreatePIModal } from './CreatePIModal';
import { IterationsOverviewTab } from './IterationsOverviewTab';
import { SprintKanbanBoard } from './SprintKanbanBoard';
import {
  sortProjectSprints,
  buildProjectTeamMembers,
  buildSprintIssuesMap,
  buildSprintBoardTasks,
} from '../../utils/sprintIssues';
import { groupSprintsByPi, sortProjectPis } from '../../utils/programIncrement';
import type { SprintIncompleteTaskAction } from '../../types';

interface SprintManagerProps {
  projectId: string;
  initialSubView?: 'board' | 'overview';
  embedded?: boolean;
}

export const SprintManager: React.FC<SprintManagerProps> = ({ projectId, initialSubView = 'overview', embedded = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramSubView = searchParams.get('subView') as 'board' | 'overview' | null;
  const {
    sprints,
    tasks,
    users,
    teams,
    projects,
    retrospectiveItems,
    sprintLinks,
    issueStatusOverrides,
    issueResolutions,
    issueAssigneeOverrides,
    getSprintLinks,
    pis,
    updateSprintStatus,
    updateTask,
    updateTaskStatus,
    createTask,
    assignSprintTeamLeader,
    addSprintMember,
    removeSprintMember,
    assignTask,
    updateSprintGoal,
  } = useAppStore();
  const { currentUser } = useAuthStore();

  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreatePIModal, setShowCreatePIModal] = useState(false);
  const [createIterationPiId, setCreateIterationPiId] = useState<string | undefined>(undefined);
  const [subView] = useState<'board' | 'overview'>(paramSubView || initialSubView);
  const [editingGoalSprintId, setEditingGoalSprintId] = useState<string | null>(null);
  const [goalEditValue, setGoalEditValue] = useState('');

  // Quick Task Create State
  const [quickTaskSprintId, setQuickTaskSprintId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<Priority>('MEDIUM');

  // Expanded sprints tracker (all expanded by default)
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({});

  // Drag and Drop active highlight state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Show backlog drawer toggle
  const [showBacklog, setShowBacklog] = useState(false);

  // TL Assignment state
  const [assigningTlSprintId, setAssigningTlSprintId] = useState<string | null>(null);

  // Member Assignment state (for TL view)
  const [showMemberModal, setShowMemberModal] = useState<string | null>(null);

  // Task Member Assignment state (for TL view - per task)
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [selectedRetroSprint, setSelectedRetroSprint] = useState<Sprint | null>(null);
  const [linkingSprint, setLinkingSprint] = useState<Sprint | null>(null);
  const [reportsMenuSprintId, setReportsMenuSprintId] = useState<string | null>(null);
  const [startBlockedSprint, setStartBlockedSprint] = useState<{ sprint: Sprint; blockingLinks: any[] } | null>(null);
  const assignMenuRef = useRef<HTMLDivElement>(null);

  // Close assignment dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(event.target as Node)) {
        setAssigningTaskId(null);
      }
    };
    if (assigningTaskId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigningTaskId]);

  const projectSprints = sprints
    .filter((s) => s.projectId === projectId && !s.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Project → PI → Iteration: parent PIs and the PI-grouped iteration list.
  const projectPis = useMemo(() => sortProjectPis(pis, projectId), [pis, projectId]);
  const iterationGroups = useMemo(
    () => groupSprintsByPi(projectSprints, pis, projectId),
    [projectSprints, pis, projectId]
  );

  // Work Queue tasks (tasks for this project not assigned to any sprint)
  const backlogTasks = tasks.filter((t) => t.projectId === projectId && !t.sprintId);

  // Seed issues are the shared sprint content the Live Iteration page renders. The
  // Iteration Board synthesises them into transient cards so both boards show the same
  // work items and the same status / resolution state.
  const projectRecord = projects.find((p) => p.id === projectId);
  const projectKey = getIssueKeyPrefix(projectRecord) || 'PRJ';
  const projectTeamMembers = useMemo(
    () => buildProjectTeamMembers(projectRecord, teams, users),
    [projectRecord, teams, users]
  );
  const seedIssuesBySprint = useMemo(
    () =>
      buildSprintIssuesMap({
        tasks,
        users,
        project: projectRecord,
        projectId,
        projectKey,
        projectTeamMembers,
        projectSprints: sortProjectSprints(sprints, projectId),
      }),
    [tasks, users, projectRecord, projectId, projectKey, projectTeamMembers, sprints]
  );

  const isExpanded = (sprintId: string) => {
    return expandedSprints[sprintId] !== undefined ? expandedSprints[sprintId] : true;
  };

  const toggleExpand = (sprintId: string) => {
    setExpandedSprints((prev) => ({
      ...prev,
      [sprintId]: !isExpanded(sprintId),
    }));
  };

  // Dynamic Column Status conversion helper for cards
  const getTaskColumnBadge = (task: Task) => {
    // Cancelled is a real status (legacy DONE + resolution maps here too).
    if (isCancelledWorkItem(task)) {
      return {
        text: 'Cancelled',
        className: 'bg-slate-100 text-slate-600 border border-slate-300 font-bold',
        dotClass: 'bg-slate-400',
      };
    }
    if (task.status === 'DONE') {
      return {
        text: 'Done',
        className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
        dotClass: 'bg-emerald-600',
      };
    }
    if (
      task.status === 'IN_PROGRESS' ||
      task.status === 'IN_REVIEW' ||
      task.status === 'TESTING' ||
      task.status === 'BUG_FIX'
    ) {
      return {
        text: 'In-Progress',
        className: 'bg-blue-100 text-blue-800 border border-blue-300 font-bold',
        dotClass: 'bg-blue-600 animate-pulse',
      };
    }
    return {
      text: 'Remaining',
      className: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
      dotClass: 'bg-amber-600',
    };
  };

  // Open the shared PI-aware Create Iteration modal (Project → PI → Iteration),
  // optionally preselecting the PI whose group "+ Add Iteration" was clicked.
  const openCreateIteration = (piId?: string) => {
    setCreateIterationPiId(piId);
    setShowCreateSprint(true);
  };

  // Quick task creation inside a sprint
  const handleQuickCreateTask = (sprintId: string) => {
    if (!quickTaskTitle.trim()) return;

    createTask({
      projectId,
      sprintId,
      title: quickTaskTitle.trim(),
      description: `Task for iteration`,
      type: 'TASK',
      status: 'TODO',
      priority: quickTaskPriority,
      createdById: currentUser?.id || 'u-admin-01',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    toast.success(`Task "${quickTaskTitle}" added to iteration`);
    setQuickTaskTitle('');
    setQuickTaskSprintId(null);
  };

  // HTML5 Drag and Drop handlers (Project Work Queue drawer drag source only —
  // the Live Iteration board itself owns its drag/drop in SprintKanbanBoard)
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string, sprintId?: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId, sprintId }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {!embedded && (
        /* Standalone header — no secondary view switcher; the primary module
           navigation owns Iterations / Live Iteration / Iteration Board / Reports */
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#e0e2ec]">
          <div>
            <h2 className="text-lg font-bold text-[#1f1f1f] tracking-tight font-display flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-[#1a73e8]" />
              Iteration Management & Task Board
            </h2>
            <p className="text-xs text-[#747775] mt-0.5">
              {subView === 'board'
                ? 'Tasks in Total dynamically convert their status (In-Progress, Remaining, Done) when dragged into any column.'
                : 'Plan iterations, scope work and track cadence for this project.'}
            </p>
          </div>

          {subView === 'board' && (
            <div className="flex items-center gap-2">
              {backlogTasks.length > 0 && (
                <button
                  onClick={() => setShowBacklog(!showBacklog)}
                  className={`btn-secondary btn-sm ${showBacklog ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#1a73e8]' : ''}`}
                >
                  <ListTodo className="w-4 h-4" />
                  <span>Project Work Queue ({backlogTasks.length})</span>
                </button>
              )}

              <button className="btn-secondary btn-sm shadow-sm" onClick={() => setShowCreatePIModal(true)}>
                <ListTree className="w-4 h-4" />
                <span>Create PI</span>
              </button>

              <button className="btn-primary btn-sm shadow-sm" onClick={() => openCreateIteration()}>
                <Plus className="w-4 h-4" />
                <span>Create Iteration</span>
              </button>
            </div>
          )}
        </div>
      )}

      {subView === 'overview' && (
        <IterationsOverviewTab projectId={projectId} />
      )}

      {subView === 'board' && (
        <>

      {/* Project Work Queue Drawer (Drag source for unassigned tasks) */}
      {showBacklog && backlogTasks.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border-2 border-dashed border-[#1a73e8] shadow-xs animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1a73e8]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1f1f1f]">
                Unassigned Project Work Queue — Drag tasks into Total, In-Progress, Remaining, or Done
              </h4>
            </div>
            <button className="btn-ghost p-1 text-slate-400 hover:text-slate-600" onClick={() => setShowBacklog(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {backlogTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const statusBadge = getTaskColumnBadge(task);
              return (
                <div
                  key={`backlog-${task.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className="w-64 flex-shrink-0 bg-[#f8fafd] rounded-xl p-3 border border-[#e0e2ec] shadow-2xs hover:shadow-md hover:border-[#1a73e8] cursor-grab active:cursor-grabbing transition-all"
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(issuePath(task));
                      }}
                      className="text-[10px] font-bold text-[#747775] hover:text-[#1a73e8] hover:underline cursor-pointer transition-colors"
                      title="Click to open task page"
                    >
                      {task.id}
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <h5
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(issuePath(task));
                    }}
                    className="text-xs font-bold text-[#1f1f1f] line-clamp-1 mb-1 cursor-pointer hover:text-[#1a73e8] transition-colors"
                    title="Click to open task page"
                  >
                    {task.title}
                  </h5>
                  {task.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mb-2 leading-tight" title={task.description}>
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[#747775] pt-1.5 border-t border-[#e0e2ec]">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${statusBadge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                      {statusBadge.text}
                    </span>
                    {assignee && (
                      <div className="flex items-center gap-1">
                        <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                        <span className="text-[10px] truncate max-w-[70px]">{assignee.name.split(' ')[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Create Iteration (shared, PI-aware — Project → PI → Iteration) */}
      <CreateIterationModal
        projectId={projectId}
        isOpen={showCreateSprint}
        initialPiId={createIterationPiId}
        onClose={() => setShowCreateSprint(false)}
      />

      {/* Modal: Create PI (parent of iterations) */}
      <CreatePIModal
        projectId={projectId}
        isOpen={showCreatePIModal}
        onClose={() => setShowCreatePIModal(false)}
      />

      {/* Iterations List */}
      {projectSprints.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#e0e2ec]">
          <EmptyState
            icon={projectPis.length === 0 ? ListTree : CalendarRange}
            title={projectPis.length === 0 ? 'No PI Configured' : 'No Iterations Configured'}
            description={
              projectPis.length === 0
                ? 'Create a PI first — iterations are generated inside a PI and numbered from it (PI 30 → 30.1, 30.2 …).'
                : `Create your first iteration of ${projectPis[0]?.name} to organize work items into Total, Executing, Queued, and Delivered boards.`
            }
            action={
              projectPis.length === 0
                ? { label: 'Create First PI', onClick: () => setShowCreatePIModal(true) }
                : { label: 'Create First Iteration', onClick: () => openCreateIteration(projectPis[0]?.id) }
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {iterationGroups.map((group) => (
            <div key={group.key} className="space-y-3">
              {/* PI group header — Project → PI → Iteration */}
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1] flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d9488] text-white text-[11px] font-bold">
                    <ListTree className="w-3 h-3" />
                    {group.label}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0f766e]">
                    {group.sprints.length} iteration{group.sprints.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    openCreateIteration(
                      group.piId || projectPis.find((p) => p.number === group.number)?.id
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-[#0f766e] bg-white hover:bg-[#ccfbf1] border border-[#99f6e4] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Iteration
                </button>
              </div>
              <div className="space-y-6">
                {group.sprints.map((sprint) => {
            const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
            const boardTasks: Task[] = [
              ...sprintTasks,
              ...buildSprintBoardTasks({
                issues: seedIssuesBySprint[sprint.id] || [],
                storeTasks: sprintTasks,
                projectId,
                sprintId: sprint.id,
                users,
                issueStatusOverrides,
                issueResolutions,
                issueAssigneeOverrides,
              }),
            ];
            const doneTasks = sprintTasks.filter((t) => t.status === 'DONE');
            const inProgTasks = sprintTasks.filter((t) =>
              t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING' || t.status === 'BUG_FIX'
            );
            const remainingTasks = sprintTasks.filter((t) =>
              t.status === 'TODO' || t.status === 'BLOCKED' || t.status === 'RETEST'
            );
            const blockedTasks = sprintTasks.filter((t) => t.status === 'BLOCKED');
            const progress = sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0;
            const expanded = isExpanded(sprint.id);

            return (
              <div
                key={sprint.id}
                className="bg-white rounded-3xl border border-[#e0e2ec] shadow-2xs overflow-hidden transition-all"
              >
                {/* Iteration Header & Summary */}
                <div className="p-5 bg-white border-b border-[#f1f3f4]">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <button
                          onClick={() => toggleExpand(sprint.id)}
                          className="flex items-center gap-1.5 text-base font-bold text-[#1f1f1f] hover:text-[#1a73e8] transition-colors font-display"
                        >
                          {expanded ? <ChevronUp className="w-4 h-4 text-[#747775]" /> : <ChevronDown className="w-4 h-4 text-[#747775]" />}
                          {sprint.name}
                        </button>
                        <SprintStatusBadge status={sprint.status} />
                        <span className="text-xs text-[#747775] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                        </span>
                      </div>

                      {sprint.goal && (
                        <p className="text-xs text-[#444746] flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-[#1a73e8] flex-shrink-0" />
                          <span className="truncate">{sprint.goal}</span>
                        </p>
                      )}

                      {/* Assigned Team Leader info */}
                      {sprint.teamLeaderId && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#444746]">
                          <UserPlus className="w-3.5 h-3.5 text-[#34a853] flex-shrink-0" />
                          <span>Team Leader: </span>
                          {(() => {
                            const tl = users.find((u) => u.id === sprint.teamLeaderId);
                            return tl ? (
                              <span className="flex items-center gap-1">
                                <Avatar name={tl.name} color={tl.avatarColor} size="xs" />
                                <span className="font-semibold">{tl.name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Unknown</span>
                            );
                          })()}
                        </div>
                      )}

                      {/* Iteration Members info */}
                      {sprint.memberIds && sprint.memberIds.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-[#444746]">
                          <Users className="w-3.5 h-3.5 text-[#1a73e8] flex-shrink-0" />
                          <span>{sprint.memberIds.length} member{sprint.memberIds.length !== 1 ? 's' : ''} assigned</span>
                        </div>
                      )}

                      {/* Cross-Project Iteration Dependencies & Links */}
                      {(() => {
                        const links = getSprintLinks(sprint.id);
                        if (links.length === 0) return null;
                        return (
                          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                              <Link2 className="w-3 h-3 text-indigo-600" />
                              Cross-Project Links:
                            </span>
                            {links.map((item) => (
                              <button
                                key={item.link.id}
                                type="button"
                                onClick={() => setLinkingSprint(sprint)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                                  item.isBlocked
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                                    : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100 shadow-2xs'
                                }`}
                                title={`Click to manage links. Project: ${item.otherProject.name} — ${item.otherSprint.name}`}
                              >
                                <span className="font-bold text-slate-800">[{item.otherProject.name}]</span>
                                <span>{item.otherSprint.name}</span>
                                <SprintStatusBadge status={item.otherSprint.status} />
                                {item.isBlocked && (
                                  <span className="text-amber-700 font-bold ml-0.5 flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Prerequisite Unmet
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Iteration Lifecycle Controls & Quick Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="btn-secondary btn-sm text-xs"
                        onClick={() => {
                          setQuickTaskSprintId(quickTaskSprintId === sprint.id ? null : sprint.id);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 text-[#1a73e8]" />
                        <span>Add Task</span>
                      </button>

                      {/* Edit Iteration Goal */}
                      <button
                        className="btn-secondary btn-sm text-xs"
                        onClick={() => {
                          setEditingGoalSprintId(editingGoalSprintId === sprint.id ? null : sprint.id);
                          setGoalEditValue(sprint.goal);
                        }}
                      >
                        <Target className="w-3.5 h-3.5 text-[#747775]" />
                        <span>Edit Goal</span>
                      </button>

                      {/* PM / ADMIN: Assign Team Leader */}
                      {(currentUser?.role === 'PROJECT_MANAGER' || currentUser?.role === 'ADMIN') && (
                        <div className="relative">
                          <button
                            className={`btn-secondary btn-sm text-xs ${sprint.teamLeaderId ? 'border-[#34a853] text-[#137333]' : ''}`}
                            onClick={() => setAssigningTlSprintId(assigningTlSprintId === sprint.id ? null : sprint.id)}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{sprint.teamLeaderId ? 'Change TL' : 'Assign TL'}</span>
                          </button>
                          {assigningTlSprintId === sprint.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 animate-scale-in">
                              <div className="px-3 py-2 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-800">Assign Team Leader</span>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                {users
                                  .filter((u) => u.role === 'TEAM_LEADER' && u.status === 'ACTIVE')
                                  .map((tl) => (
                                    <button
                                      key={tl.id}
                                      type="button"
                                      onClick={() => {
                                        assignSprintTeamLeader(sprint.id, tl.id);
                                        setAssigningTlSprintId(null);
                                        toast.success(`Assigned ${tl.name} as Team Leader`);
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left ${
                                        sprint.teamLeaderId === tl.id ? 'bg-blue-50' : ''
                                      }`}
                                    >
                                      <Avatar name={tl.name} color={tl.avatarColor} size="sm" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-900">{tl.name}</div>
                                        <div className="text-[10px] text-slate-500">{tl.email}</div>
                                      </div>
                                      {sprint.teamLeaderId === tl.id && (
                                        <Check className="w-4 h-4 text-blue-600" />
                                      )}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TL / PM / ADMIN: Add Team Members */}
                      {((currentUser?.role === 'TEAM_LEADER' && sprint.teamLeaderId === currentUser?.id) ||
                        currentUser?.role === 'PROJECT_MANAGER' ||
                        currentUser?.role === 'ADMIN') && (
                        <button
                          className="btn-secondary btn-sm text-xs"
                          onClick={() => setShowMemberModal(showMemberModal === sprint.id ? null : sprint.id)}
                        >
                          <Users className="w-3.5 h-3.5 text-[#1a73e8]" />
                          <span>Add Team Members</span>
                        </button>
                      )}

                      {/* Link Iteration (Cross-Project) Button */}
                      <button
                        className="btn-secondary btn-sm text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-50"
                        onClick={() => setLinkingSprint(sprint)}
                        title="Link with iterations from other projects"
                      >
                        <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Link Iteration</span>
                        {(() => {
                          const links = getSprintLinks(sprint.id);
                          return links.length > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {links.length}
                            </span>
                          ) : null;
                        })()}
                      </button>

                      {sprint.status === 'PLANNED' && (
                        <button
                          className="btn-primary btn-sm text-xs flex items-center gap-1.5"
                          onClick={() => {
                            const links = getSprintLinks(sprint.id);
                            const blockedDeps = links.filter((l) => l.isBlocked);
                            if (blockedDeps.length > 0) {
                              setStartBlockedSprint({ sprint, blockingLinks: blockedDeps });
                            } else {
                              updateSprintStatus(sprint.id, 'ACTIVE');
                              toast.success(`"${sprint.name}" is now Active!`);
                            }
                          }}
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Iteration</span>
                        </button>
                      )}

                      {sprint.status === 'ACTIVE' && (
                        <button
                          className="btn-secondary btn-sm text-xs text-[#137333] border-[#ceead6] hover:bg-[#e6f4ea]"
                          onClick={() => setCompletingSprint(sprint)}
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Complete Iteration</span>
                        </button>
                      )}

                      {/* Iteration Retrospective Button */}
                      <button
                        className={`btn-secondary btn-sm text-xs flex items-center gap-1.5 transition-all ${
                          sprint.status === 'COMPLETED'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-2xs font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedRetroSprint(sprint)}
                        title="Open Iteration Retrospective ceremony board"
                      >
                        <MessageSquareHeart className={`w-3.5 h-3.5 ${sprint.status === 'COMPLETED' ? 'text-purple-600' : 'text-teal-600'}`} />
                        <span>Retrospective</span>
                        {(() => {
                          const count = retrospectiveItems.filter((i) => i.sprintId === sprint.id).length;
                          return count > 0 ? (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sprint.status === 'COMPLETED' ? 'bg-purple-200 text-purple-900' : 'bg-slate-200 text-slate-800'
                            }`}>
                              {count}
                            </span>
                          ) : null;
                        })()}
                      </button>

                      {/* Iteration Details Page Link */}
                      <button
                        className="btn-secondary btn-sm text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900"
                        onClick={() => {
                          const project = projects.find((p) => matchId(p.id, projectId));
                          const url = project
                            ? `${getProjectUrl(project, 'PROJECT_MANAGER')}/sprints/${toUrlId(sprint.id)}`
                            : `/pm/projects/${toUrlId(projectId)}/sprints/${toUrlId(sprint.id)}`;
                          navigate(url);
                        }}
                        title="View Iteration Details & Task Decisions"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>Details</span>
                      </button>

                      {/* Reports Dropdown (reuses existing Insights report components) */}
                      <div className="relative">
                        <button
                          className="btn-secondary btn-sm text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
                          onClick={() => setReportsMenuSprintId(reportsMenuSprintId === sprint.id ? null : sprint.id)}
                          title="View iteration analytics & reports"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Reports</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {reportsMenuSprintId === sprint.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in text-xs">
                            {([
                              { view: 'sprint-report', label: 'Iteration Report', icon: FileText, color: 'text-teal-600' },
                              { view: 'burndown', label: 'Burndown Chart', icon: TrendingDown, color: 'text-indigo-600' },
                              { view: 'velocity', label: 'Velocity Report', icon: Zap, color: 'text-amber-600' },
                              { view: 'cfd', label: 'Cumulative Flow', icon: GitBranch, color: 'text-purple-600' },
                            ] as const).map(({ view, label, icon: Icon, color }) => (
                              <button
                                key={view}
                                type="button"
                                onClick={() => {
                                  setReportsMenuSprintId(null);
                                  const project = projects.find((p) => matchId(p.id, projectId));
                                  const base = project ? getProjectUrl(project, currentUser?.role) : `/pm/projects/${toUrlId(projectId)}`;
                                  navigate(`${base}?tab=insights&sprintId=${encodeURIComponent(sprint.id)}&view=${view}`);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                              >
                                <Icon className={`w-3.5 h-3.5 ${color}`} />
                                <span>{label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TL / PM / ADMIN warning: No members assigned */}
                  {((currentUser?.role === 'TEAM_LEADER' && sprint.teamLeaderId === currentUser?.id) ||
                    currentUser?.role === 'PROJECT_MANAGER' ||
                    currentUser?.role === 'ADMIN') && (!sprint.memberIds || sprint.memberIds.length === 0) && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>No team members assigned to this iteration yet. Click <strong>"Add Team Members"</strong> to add members before assigning tasks.</span>
                    </div>
                  )}

                  {/* Progress & Stat Chips */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                    <div className="flex-1 max-w-md">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#747775] mb-1">
                        <span>Iteration Completion</span>
                        <span className="text-[#1f1f1f]">{progress}%</span>
                      </div>
                      <ProgressBar value={progress} height="sm" color="#1a73e8" />
                    </div>

                    {/* Interactive Stat summary pill badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
                        Total: <span className="text-slate-900 ml-0.5">{sprintTasks.length}</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-700">
                        In-Progress: <span className="text-blue-900 ml-0.5">{inProgTasks.length}</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
                        Remaining: <span className="text-amber-900 ml-0.5">{remainingTasks.length}</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                        Done: <span className="text-emerald-900 ml-0.5">{doneTasks.length}</span>
                      </div>
                      {blockedTasks.length > 0 && (
                        <div className="px-2.5 py-1 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                          Blocked: <span className="text-red-900 ml-0.5">{blockedTasks.length}</span>
                        </div>
                      )}
                      {/* Story Points */}
                      {sprintTasks.some((t) => t.storyPoints) && (
                        <>
                          <div className="px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-700">
                            Points: <span className="text-purple-900 ml-0.5">{sprintTasks.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.storyPoints || 0), 0)}/{sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)}</span>
                          </div>
                          {sprint.status === 'COMPLETED' && (
                            <div className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700">
                              Velocity: <span className="text-indigo-900 ml-0.5">{sprintTasks.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.storyPoints || 0), 0)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Task Creation inside this Iteration */}
                  {quickTaskSprintId === sprint.id && (
                    <div className="mt-4 p-3.5 rounded-2xl bg-[#f8fafd] border border-[#e0e2ec] animate-slide-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1f1f1f]">Quick Add Task to {sprint.name}</span>
                        <button className="btn-ghost p-1 text-slate-400" onClick={() => setQuickTaskSprintId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreateTask(sprint.id); }}
                          placeholder="Task title (e.g. Implement OAuth login provider)"
                          className="input flex-1 py-1.5 text-xs"
                          autoFocus
                        />
                        <select
                          value={quickTaskPriority}
                          onChange={(e) => setQuickTaskPriority(e.target.value as Priority)}
                          className="select sm:w-32 py-1.5 text-xs"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleQuickCreateTask(sprint.id)}
                          className="btn-primary btn-sm text-xs justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Task
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit Iteration Goal */}
                  {editingGoalSprintId === sprint.id && (
                    <div className="mt-4 p-3.5 rounded-2xl bg-[#f8fafd] border border-[#e0e2ec] animate-slide-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1f1f1f] flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-[#1a73e8]" />
                          Edit Iteration Goal
                        </span>
                        <button className="btn-ghost p-1 text-slate-400" onClick={() => setEditingGoalSprintId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={goalEditValue}
                        onChange={(e) => setGoalEditValue(e.target.value)}
                        placeholder="Enter iteration goal..."
                        className="input resize-none h-16 text-xs mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm text-xs"
                          onClick={() => setEditingGoalSprintId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary btn-sm text-xs"
                          onClick={() => {
                            updateSprintGoal(sprint.id, goalEditValue);
                            setEditingGoalSprintId(null);
                            toast.success('Iteration goal updated');
                          }}
                        >
                          <Check className="w-3.5 h-3.5" /> Save Goal
                        </button>
                      </div>
                    </div>
                  )}


                </div>

                {/* Live Iteration board: TO DO / IN PROGRESS / DONE with directional
                    transition rules and an optional rich text comment + screenshot
                    modal (see SprintKanbanBoard). boardTasks carries the seed issues
                    too, so this board matches the Live Iteration page. */}
                {expanded && (
                  <SprintKanbanBoard projectId={projectId} sprint={sprint} sprintTasks={boardTasks} />
                )}
              </div>
            );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Members Assignment Modal (TL View) */}
      {showMemberModal && (() => {
        const sprint = sprints.find((s) => s.id === showMemberModal);
        if (!sprint) return null;
        const assignedMembers = sprint.memberIds || [];
        const allMembers = users.filter((u) => u.role === 'MEMBER' && u.status === 'ACTIVE');
        const availableMembers = allMembers.filter((m) => !assignedMembers.includes(m.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-modal animate-scale-in max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Team Members</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{sprint.name}</p>
                </div>
                <button className="btn-ghost p-2" onClick={() => setShowMemberModal(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Currently Assigned Members */}
                {assignedMembers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Assigned ({assignedMembers.length})
                    </h3>
                    <div className="space-y-2">
                      {assignedMembers.map((memberId) => {
                        const member = users.find((u) => u.id === memberId);
                        if (!member) return null;
                        return (
                          <div key={memberId} className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                            <Avatar name={member.name} color={member.avatarColor} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-900">{member.name}</div>
                              <div className="text-[10px] text-slate-500">{member.email}</div>
                            </div>
                            <button
                              onClick={() => {
                                removeSprintMember(sprint.id, memberId);
                                toast.success(`Removed ${member.name} from iteration`);
                              }}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Members to Add */}
                <div>
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    {assignedMembers.length > 0 ? 'Add More Members' : 'Available Members'}
                  </h3>
                  {availableMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">All members are already assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {availableMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            addSprintMember(sprint.id, member.id);
                            toast.success(`Added ${member.name} to iteration`);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-colors text-left"
                        >
                          <Avatar name={member.name} color={member.avatarColor} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900">{member.name}</div>
                            <div className="text-[10px] text-slate-500">{member.email}</div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  className="btn-primary w-full justify-center text-sm"
                  onClick={() => setShowMemberModal(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Iteration Completion Modal */}
      {completingSprint && (
        <SprintCompletionModal
          sprint={completingSprint}
          isOpen={true}
          onClose={() => setCompletingSprint(null)}
          onComplete={(_action, startRetro) => {
            const sprintCopy = completingSprint;
            setCompletingSprint(null);
            if (startRetro && sprintCopy) {
              setSelectedRetroSprint(sprintCopy);
            }
          }}
        />
      )}

      {/* Iteration Retrospective Modal */}
      {selectedRetroSprint && (
        <SprintRetrospectiveModal
          sprint={selectedRetroSprint}
          isOpen={true}
          onClose={() => setSelectedRetroSprint(null)}
        />
      )}

      {/* Cross-Project Iteration Link Modal */}
      {linkingSprint && (
        <SprintLinkModal
          sprint={linkingSprint}
          isOpen={true}
          onClose={() => setLinkingSprint(null)}
        />
      )}

      {/* Start Iteration Blocker Advisory Warning Dialog */}
      {startBlockedSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Upstream Dependency Unfinished</h3>
                <p className="text-xs text-slate-500">Cross-project prerequisite warning</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>"{startBlockedSprint.sprint.name}"</strong> depends on prerequisite iteration(s) in other projects that are not marked as completed yet:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {startBlockedSprint.blockingLinks.map((item) => (
                <div
                  key={item.link.id}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {item.otherProject.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {item.otherSprint.name}
                    </div>
                  </div>
                  <SprintStatusBadge status={item.otherSprint.status} />
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Starting this iteration now might cause your team to get blocked by unfinished external dependencies.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary btn-sm text-xs"
                onClick={() => setStartBlockedSprint(null)}
              >
                Wait & Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-sm text-xs bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  updateSprintStatus(startBlockedSprint.sprint.id, 'ACTIVE');
                  toast.warning(`Started "${startBlockedSprint.sprint.name}" despite open dependencies.`);
                  setStartBlockedSprint(null);
                }}
              >
                Start Anyway (Override)
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
