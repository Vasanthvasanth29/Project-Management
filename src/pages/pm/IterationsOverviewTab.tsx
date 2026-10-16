import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Flag,
  Filter, Search, MoreHorizontal, ChevronDown, ChevronRight, ChevronsUp,
  Users, ExternalLink, Plus, X, Layers, Calendar, Check,
  ArrowRight, ArrowLeft, FileText, Sparkles, Hash, Edit3, Trash2, Eye,
  ArrowUpRight, Link2, Share2, Shield, BarChart3, RefreshCw,
  CalendarRange, Archive, ListTree, Play, CheckCircle, FolderInput, History
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { StatusBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { WorkItemIcon } from '../../components/common/WorkItemIcon';
import { toUrlId, matchId, getProjectUrl } from '../../utils/idUtils';
import { getIssueKeyPrefix } from '../../utils/projectIdentity';
import { issuePath } from '../../utils/issueUrl';
import {
  canManageSprint, canStartSprint, canCompleteSprint,
  canEditSprint, canArchiveSprint, canDeleteSprint,
  isCancelledWorkItem
} from '../../utils/roleUtils';
import { buildSprintIdentifiers, formatSprintIdentifier, formatSprintFullTitle, formatSprintPiTitle } from '../../utils/sprintIdentifier';
import { sortProjectPis } from '../../utils/programIncrement';
import { usePiPlan, splitPiPlanSections } from '../../data/piSprintStructure';
import type { PlanPi, PlanSections } from '../../data/piSprintStructure';
import type { IterationIssue } from '../../utils/sprintIssues';
import {
  getEpicColor,
  sortProjectSprints,
  buildProjectTeamMembers,
  buildSprintIssuesMap,
  resolveIssueTaskId,
} from '../../utils/sprintIssues';
import { SprintCompletionModal } from './SprintCompletionModal';
import { CreateIterationModal } from './CreateIterationModal';
import { CreatePIModal } from './CreatePIModal';
import { BacklogOverviewTab } from './BacklogOverviewTab';
import { MoveTaskModal } from '../shared/tasks/MoveTaskModal';
import type { TaskStatus, Priority, Task, Sprint } from '../../types';

interface IterationsOverviewTabProps {
  projectId: string;
  /**
   * 'cadence' (default) — the main Iterations page: ACTIVE + PLANNED sections
   * rendered inline. 'completed' — the separate Completed Iterations tab:
   * only finished iterations, grouped under their original PI.
   */
  view?: 'cadence' | 'completed';
}

interface LinkedPage {
  id: string;
  title: string;
  url: string;
  space: string;
  updatedAt: string;
}

export const IterationsOverviewTab: React.FC<IterationsOverviewTabProps> = ({ projectId, view = 'cadence' }) => {
  const isCompletedView = view === 'completed';
  const navigate = useNavigate();
  const { projects, sprints, pis, tasks, users, teams, updateSprintStatus, updateSprint, deleteSprint, handleIncompleteTasks } = useAppStore();
  const { currentUser } = useAuthStore();

  // Iteration lifecycle permissions — resolved once from the authenticated user's existing
  // role so role checks are never duplicated across JSX locations.
  const sprintRole = currentUser?.role;
  const canManage = canManageSprint(sprintRole);
  const canArchive = canArchiveSprint(sprintRole);
  const canDelete = canDeleteSprint(sprintRole);

  const project = projects.find((p) => p.id === projectId);
  const projectKey = getIssueKeyPrefix(project) || 'PRJ';

  // Find all sprints for this project. Display order mirrors the reference backlog:
  // the active iteration first, then upcoming iterations chronologically, then the
  // completed ones — so every iteration is reachable as its own expandable section.
  const projectSprints = useMemo(() => sortProjectSprints(sprints, projectId), [sprints, projectId]);

  // Project's Program Increments (parents) and the PI-grouped iteration list —
  // Project → PI → Iteration, so iterations are never one flat project list.
  const projectPis = useMemo(() => sortProjectPis(pis, projectId), [pis, projectId]);

  // The centralized PI → Sprint plan, split per-sprint into the Overview's
  // ACTIVE / PLANNED sections and the separate Completed Iterations tab —
  // the one source shared with the Move Work Item modal.
  const piPlan = usePiPlan(projectId);
  const planSections: PlanSections = useMemo(() => splitPiPlanSections(piPlan), [piPlan]);

  // Sections rendered by this view: the main page shows ACTIVE + PLANNED
  // inline (never as tabs); the Completed tab shows COMPLETED only.
  const overviewSections = useMemo(
    () =>
      isCompletedView
        ? [{ key: 'completed', label: 'COMPLETED', pis: planSections.completed }]
        : [
            { key: 'active', label: 'ACTIVE', pis: planSections.active },
            { key: 'planned', label: 'PLANNED', pis: planSections.planned },
          ],
    [isCompletedView, planSections]
  );
  const hasVisibleSections = overviewSections.some((s) => s.pis.length > 0);

  // Deep links into the iterations module — built from the project + role so
  // they work both inside the module and when this tab is embedded elsewhere
  // (Project Workspace, Sprint Manager).
  const iterationsModuleUrl = `${getProjectUrl(project, currentUser?.role)}/iterations`;

  // Determine active sprint or fallback
  const defaultSprint = useMemo(() => {
    return (
      projectSprints.find((s) => s.status === 'ACTIVE') ||
      projectSprints[0] ||
      {
        id: 'spr-current',
        projectId,
        piId: '',
        iterationNumber: '',
        name: `${projectKey} 3.1`,
        goal: 'Payment integration, order management, and notifications',
        status: 'ACTIVE' as const,
        startDate: '2024-09-15',
        endDate: '2024-09-28',
        taskIds: [],
        createdById: 'u-pm-01',
        createdAt: '2024-09-04T00:00:00Z',
      }
    );
  }, [projectSprints, projectId]);

  const [selectedSprintId, setSelectedSprintId] = useState<string>(defaultSprint.id);

  // The focused iteration drives the modals (edit / details / delete / archive) and the
  // header Create menu. Only re-validate it when the underlying sprint set changes —
  // selecting another sprint from its own row menu must never snap back to the active one.
  useEffect(() => {
    setSelectedSprintId((prev) =>
      projectSprints.some((s) => s.id === prev) ? prev : defaultSprint.id
    );
  }, [projectSprints, defaultSprint]);

  const currentSprint = projectSprints.find((s) => s.id === selectedSprintId) || defaultSprint;

  // One-based sprint identifiers: <Project Key><PI>.<Iteration Number>, e.g. ECOMM4.1
  const sprintIdentifiers = useMemo(
    () => buildSprintIdentifiers(projectSprints, projectKey),
    [projectSprints, projectKey]
  );

  const getSprintIdentifier = (sprint: Sprint): string =>
    formatSprintIdentifier(sprint, projectKey, sprintIdentifiers);

  // Format any sprint as "ECOMM4.1 [15 SEP - 28 SEP]"
  const formatSprintTitle = (sprint: Sprint): string =>
    formatSprintFullTitle(sprint, projectKey, sprintIdentifiers);

  const sprintDisplayTitle = formatSprintTitle(currentSprint);

  // "23/Sep/26 1:31 PM" style timestamps used by the iteration sub-header rows
  const formatSprintDate = (isoDate: string | undefined, time: string): string => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${months[d.getMonth()]}/${year} ${time}`;
  };

  // Project team members for Quick Filters
  const projectTeamMembers = useMemo(
    () => buildProjectTeamMembers(project, teams, users),
    [project, teams, users]
  );

  // Per-iteration issue lists: the sprint's real work items first, topped up with
  // domain seed items so every expandable iteration section renders with realistic
  // volume. Shared with the Issue Search page so both views show identical records.
  const computedIssuesBySprint = useMemo<Record<string, IterationIssue[]>>(
    () =>
      buildSprintIssuesMap({
        tasks,
        users,
        project,
        projectId,
        projectKey,
        projectTeamMembers,
        projectSprints,
      }),
    [tasks, projectId, projectSprints, project, projectKey, users, projectTeamMembers]
  );

  // Work Items created during this session, tracked per iteration so they show up in the
  // right expandable section alongside the computed ones.
  const [localIssuesBySprint, setLocalIssuesBySprint] = useState<Record<string, IterationIssue[]>>({});

  const getIssuesForSprint = (sprintId: string): IterationIssue[] => [
    ...(localIssuesBySprint[sprintId] || []),
    ...(computedIssuesBySprint[sprintId] || []),
  ];

  // Stable issue-key range for newly created work items inside a given iteration
  const nextIssueKeyBase = (sprintId: string): number => {
    const idx = projectSprints.findIndex((s) => s.id === sprintId);
    return (idx >= 0 ? idx : 0) * 1000;
  };

  // State
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  // Per-iteration expand/collapse — the active iteration starts expanded so the page
  // opens with a visible issue list, exactly like the reference backlog view.
  const [expandedSprintIds, setExpandedSprintIds] = useState<Record<string, boolean>>({});
  const isSprintOpen = (sprintId: string): boolean =>
    expandedSprintIds[sprintId] !== undefined
      ? expandedSprintIds[sprintId]
      : sprintId === defaultSprint.id;
  const toggleSprintOpen = (sprintId: string): void => {
    setExpandedSprintIds((prev) => ({
      ...prev,
      [sprintId]: !(prev[sprintId] !== undefined ? prev[sprintId] : sprintId === defaultSprint.id),
    }));
  };
  // Global "Collapse All" — writes an explicit collapsed flag for every sprint into
  // the SAME expandedSprintIds state the individual chevrons use, so all cards fold
  // at once while each chevron keeps toggling independently afterwards.
  const collapseAllSprints = (): void => {
    const collapsed: Record<string, boolean> = {};
    projectSprints.forEach((sprint) => {
      collapsed[sprint.id] = false;
    });
    setExpandedSprintIds(collapsed);
  };

  // Per-sprint open menus (only one row menu / status switcher open at a time)
  const [moreMenuSprintId, setMoreMenuSprintId] = useState<string | null>(null);
  const [statusDropdownSprintId, setStatusDropdownSprintId] = useState<string | null>(null);
  // Iteration that will receive a newly created issue
  const [issueTargetSprintId, setIssueTargetSprintId] = useState<string | null>(null);

  // Quick filters state
  const [activePersonFilters, setActivePersonFilters] = useState<string[]>([]);
  const [onlyMyIssues, setOnlyMyIssues] = useState<boolean>(false);
  const [recentlyUpdatedOnly, setRecentlyUpdatedOnly] = useState<boolean>(false);
  const [showFewer, setShowFewer] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Popovers
  const [showLinkedPagesModal, setShowLinkedPagesModal] = useState<boolean>(false);
  const [showCreateIssueModal, setShowCreateIssueModal] = useState<boolean>(false);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState<boolean>(false);
  const [createDropdownOpen, setCreateDropdownOpen] = useState<boolean>(false);
  const [assigneesPopoverSprintId, setAssigneesPopoverSprintId] = useState<string | null>(null);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState<boolean>(false);
  const [showEditSprintModal, setShowEditSprintModal] = useState<boolean>(false);
  const [showIterationDetailsModal, setShowIterationDetailsModal] = useState<boolean>(false);
  const [showDeleteSprintConfirm, setShowDeleteSprintConfirm] = useState<boolean>(false);
  // Start-while-active conflict: the target iteration to start and the already-active
  // iteration that must be completed first (one active iteration at a time).
  const [startConflict, setStartConflict] = useState<{ target: Sprint; active: Sprint } | null>(null);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);

  // Edit Iteration Form State
  const [editSprintName, setEditSprintName] = useState<string>('');
  const [editSprintGoal, setEditSprintGoal] = useState<string>('');
  const [editSprintStartDate, setEditSprintStartDate] = useState<string>('');
  const [editSprintEndDate, setEditSprintEndDate] = useState<string>('');

  // Create Iteration / Create PI modal state — iteration creation always runs
  // through the shared PI-aware modal (Project → PI → Iteration), optionally
  // preselecting the PI whose "+ Add Iteration" opened it.
  const [createIterationPiId, setCreateIterationPiId] = useState<string | undefined>(undefined);
  const [showCreatePIModal, setShowCreatePIModal] = useState<boolean>(false);

  // Linked Pages tailored to this project
  const [linkedPages, setLinkedPages] = useState<LinkedPage[]>([
    {
      id: 'lp-1',
      title: `${project?.name || 'Project'} — Iteration Architecture & Delivery Blueprint`,
      url: 'https://confluence.enterprise.internal/pages/sprint-blueprint',
      space: `${projectKey} Engineering`,
      updatedAt: '01/Sep/26 10:15 AM'
    },
    {
      id: 'lp-2',
      title: `${projectKey} SIT & Regression Verification Test Matrix`,
      url: 'https://confluence.enterprise.internal/pages/sit-verification',
      space: 'QA & Compliance',
      updatedAt: '03/Sep/26 2:30 PM'
    },
    {
      id: 'lp-3',
      title: `${project?.name || 'Project'} Core Domain Data Model Specification`,
      url: 'https://confluence.enterprise.internal/pages/data-model-spec',
      space: `${projectKey} Architecture`,
      updatedAt: '05/Sep/26 11:20 AM'
    },
    {
      id: 'lp-4',
      title: `${projectKey} Release Readiness & Production Checklist`,
      url: 'https://confluence.enterprise.internal/pages/release-readiness',
      space: 'Release Operations',
      updatedAt: '08/Sep/26 4:00 PM'
    }
  ]);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageUrl, setNewPageUrl] = useState('');

  // Create issue form
  const [newIssueSummary, setNewIssueSummary] = useState('');
  const [newIssueType, setNewIssueType] = useState<'STORY' | 'TASK' | 'BUG'>('STORY');
  const [newIssuePoints, setNewIssuePoints] = useState<number>(3);
  const [newIssueEpic, setNewIssueEpic] = useState('Core Platform');
  const [newIssueAssignee, setNewIssueAssignee] = useState(projectTeamMembers[0]?.name || 'Priya Sharma');

  // Apply the quick filters / search to any iteration's issue list
  const filterIssues = (list: IterationIssue[]): IterationIssue[] => {
    return list.filter((issue) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(query);
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesEpic = issue.epicName.toLowerCase().includes(query);
        const matchesRelease = issue.releaseTag.toLowerCase().includes(query);
        const matchesAssignee = issue.assigneeName.toLowerCase().includes(query);
        if (!matchesKey && !matchesTitle && !matchesEpic && !matchesRelease && !matchesAssignee) {
          return false;
        }
      }

      // Quick filter: Person
      if (activePersonFilters.length > 0) {
        if (!activePersonFilters.includes(issue.assigneeName)) {
          return false;
        }
      }

      // Quick filter: Only My Work Items
      if (onlyMyIssues) {
        const myName = currentUser?.name?.toLowerCase() || '';
        if (!issue.assigneeName.toLowerCase().includes(myName.split(' ')[0])) {
          return false;
        }
      }

      // Quick filter: Recently Updated
      if (recentlyUpdatedOnly) {
        if (issue.updatedDate < '2026-09-04') {
          return false;
        }
      }

      return true;
    });
  };

  const hasActiveFilters =
    activePersonFilters.length > 0 || onlyMyIssues || recentlyUpdatedOnly || Boolean(searchQuery.trim());

  // Estimation counts (Todo, In Progress, Done points) for a single iteration
  const computeStats = (list: IterationIssue[]) => {
    let todoCount = 0;
    let inProgCount = 0;
    let doneCount = 0;

    list.forEach((t) => {
      // Cancelled work is out of scope for estimation counts.
      if (isCancelledWorkItem(t)) {
        return;
      }
      if (t.status === 'DONE') {
        doneCount += t.storyPoints;
      } else if (t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING' || t.status === 'BUG_FIX') {
        inProgCount += t.storyPoints;
      } else {
        todoCount += t.storyPoints;
      }
    });

    return {
      todoPoints: todoCount,
      inProgPoints: inProgCount,
      donePoints: doneCount,
      totalIssues: list.length,
    };
  };

  // Flagged (🚩) work items inside one iteration
  const countFlaggedForSprint = (sprintId: string): number =>
    tasks.filter((t) => t.projectId === projectId && t.sprintId === sprintId && t.isFlagged).length;

  // Members shown on an iteration row: the sprint roster when set, otherwise the
  // project team — never fabricated names.
  const getSprintMembers = (sprint: Sprint) => {
    const sprintIds = sprint.memberIds || [];
    if (sprintIds.length > 0) {
      const roster = users.filter((u) => sprintIds.includes(u.id));
      if (roster.length > 0) return roster;
    }
    return projectTeamMembers;
  };

  const togglePersonFilter = (name: string) => {
    setActivePersonFilters((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const clearAllFilters = () => {
    setActivePersonFilters([]);
    setOnlyMyIssues(false);
    setRecentlyUpdatedOnly(false);
    setSearchQuery('');
    toast.info('All filters cleared');
  };

  // Open the shared PI-aware Create Iteration modal, optionally preselecting
  // the PI whose group control was clicked (Project → PI → Add Iteration).
  const openCreateIteration = (piId?: string) => {
    setCreateIterationPiId(piId);
    setShowCreateSprintModal(true);
  };

  // Open the Edit Iteration modal pre-filled with the target iteration's real data
  const openEditSprintModal = (sprint?: Sprint) => {
    if (!canEditSprint(sprintRole)) {
      toast.error('You do not have permission to edit iterations');
      return;
    }
    const target = sprint || currentSprint;
    setSelectedSprintId(target.id);
    setEditSprintName(getSprintIdentifier(target));
    setEditSprintGoal(target.goal || '');
    setEditSprintStartDate(target.startDate || '');
    setEditSprintEndDate(target.endDate || '');
    setShowEditSprintModal(true);
  };

  const handleEditSprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSprint(sprintRole)) {
      toast.error('You do not have permission to edit iterations');
      setShowEditSprintModal(false);
      return;
    }
    updateSprint(currentSprint.id, {
      name: editSprintName.trim() || getSprintIdentifier(currentSprint),
      goal: editSprintGoal.trim(),
      startDate: editSprintStartDate || currentSprint.startDate,
      endDate: editSprintEndDate || currentSprint.endDate,
    });
    toast.success(`${editSprintName.trim() || getSprintIdentifier(currentSprint)} updated`);
    setShowEditSprintModal(false);
  };

  const handleArchiveSprint = (sprint?: Sprint) => {
    if (!canArchiveSprint(sprintRole)) {
      toast.error('You do not have permission to archive iterations');
      return;
    }
    const target = sprint || currentSprint;
    updateSprint(target.id, { isArchived: true });
    setMoreMenuSprintId(null);
    toast.success(`${getSprintIdentifier(target)} archived`);
  };

  const handleDeleteSprintConfirmed = () => {
    if (!canDeleteSprint(sprintRole)) {
      toast.error('You do not have permission to delete iterations');
      setShowDeleteSprintConfirm(false);
      return;
    }
    const name = getSprintIdentifier(currentSprint);
    deleteSprint(currentSprint.id);
    setShowDeleteSprintConfirm(false);
    toast.success(`Iteration "${name}" deleted. Its tasks were returned to the work queue.`);
  };

  // Start an upcoming iteration (row-level "Start sprint" action on the reference view).
  // Only one iteration may be active: if the project already has an active sprint,
  // confirm completing it before the selected one starts.
  const actuallyStartSprint = (sprint: Sprint) => {
    updateSprintStatus(sprint.id, 'ACTIVE');
    setExpandedSprintIds((prev) => ({ ...prev, [sprint.id]: true }));
    toast.success(`${formatSprintTitle(sprint).split(' [')[0]} started`);
  };

  const handleStartSprint = (sprint: Sprint) => {
    if (!canStartSprint(sprintRole)) {
      toast.error('You do not have permission to start iterations');
      return;
    }
    setMoreMenuSprintId(null);
    setSelectedSprintId(sprint.id);
    const activeSprint = sprints.find(
      (s) => s.projectId === sprint.projectId && s.status === 'ACTIVE' && s.id !== sprint.id
    );
    if (activeSprint) {
      setStartConflict({ target: sprint, active: activeSprint });
      return;
    }
    actuallyStartSprint(sprint);
  };

  const handleStartSprintConfirmed = () => {
    if (!startConflict) return;
    const { target, active } = startConflict;
    // Move the outgoing sprint's incomplete issues into the one being started,
    // complete it, then activate the target — single active iteration invariant.
    handleIncompleteTasks(active.id, 'MOVE_TO_NEXT_SPRINT');
    updateSprintStatus(active.id, 'COMPLETED');
    actuallyStartSprint(target);
    setStartConflict(null);
  };

  // Complete Iteration — opens the existing sprint completion flow (handles incomplete
  // issues via Move to Work Queue / Move to next sprint / Keep in completed sprint).
  const handleCompleteSprint = (sprint: Sprint) => {
    if (!canCompleteSprint(sprintRole)) {
      toast.error('You do not have permission to complete iterations');
      return;
    }
    setMoreMenuSprintId(null);
    setSelectedSprintId(sprint.id);
    setCompletingSprint(sprint);
  };

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueSummary.trim()) return;

    const targetSprintId = issueTargetSprintId || currentSprint.id;
    const targetSprint = projectSprints.find((s) => s.id === targetSprintId) || currentSprint;
    const localCount = (localIssuesBySprint[targetSprintId]?.length || 0) + (computedIssuesBySprint[targetSprintId]?.length || 0);
    const nextIdNum = nextIssueKeyBase(targetSprintId) + 900 + localCount + 1;
    const newKey = `${projectKey}-${nextIdNum}`;

    const newIssue: IterationIssue = {
      id: `task-new-${targetSprintId}-${nextIdNum}`,
      key: newKey,
      title: newIssueSummary.trim(),
      type: newIssueType,
      priority: 'HIGH',
      status: 'TODO',
      releaseTag: `${projectKey} PI24`,
      epicName: newIssueEpic,
      epicColor: getEpicColor(newIssueEpic),
      assigneeName: newIssueAssignee,
      assigneeInitial: newIssueAssignee[0] || 'U',
      assigneeAvatarColor: '#0284c7',
      storyPoints: Number(newIssuePoints) || 3,
      updatedDate: new Date().toISOString().split('T')[0]
    };

    setLocalIssuesBySprint((prev) => ({
      ...prev,
      [targetSprintId]: [newIssue, ...(prev[targetSprintId] || [])],
    }));
    setExpandedSprintIds((prev) => ({ ...prev, [targetSprintId]: true }));
    setSelectedSprintId(targetSprintId);
    setIssueTargetSprintId(null);
    toast.success(`Created ${newKey} in ${formatSprintTitle(targetSprint).split(' [')[0]} iteration`);
    setNewIssueSummary('');
    setShowCreateIssueModal(false);
  };

  // Navigate to or open the full task page for a specific task. Seed issues are
  // materialised into real work items first — shared with the Issue Search page.
  const handleOpenTask = (issue: IterationIssue, openInNewTab = false, sprintId?: string) => {
    const targetTaskId = resolveIssueTaskId({
      issue,
      projectId,
      sprintId: sprintId || currentSprint.id,
      users,
      currentUser,
    });

    const targetUrl = issuePath(targetTaskId);
    if (openInNewTab) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(targetUrl);
    }
  };

  // Row action menu (⋯): Open / Move Work Item. The menu itself never
  // navigates — only its explicit items act, each stopping propagation so the
  // row's own click → Details navigation is never triggered.
  const ROW_ACTION_MENU_W = 176;
  const [rowActionMenu, setRowActionMenu] = useState<{
    issue: IterationIssue;
    sprintId: string;
    x: number;
    y: number;
  } | null>(null);
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  // Move Work Item opens over this page. Remember the user's scroll position,
  // then nudge the page down just enough that the moved item's sprint header
  // (e.g. the active iteration card) sits above the modal instead of behind
  // it. The adjustment is computed from the sprint card's rect and the
  // modal's measured rect — never a fixed offset — so it adapts to content
  // and viewport size. The page is never unmounted or recreated; only the
  // window scroll position changes (the modal is fixed-positioned, so it
  // does not move). Restored on close/cancel/success.
  const moveModalScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!movingTask) {
      if (moveModalScrollYRef.current !== null) {
        const prev = moveModalScrollYRef.current;
        moveModalScrollYRef.current = null;
        window.scrollTo({ top: prev, left: 0, behavior: 'auto' });
      }
      return;
    }

    // Only iterations that live in a sprint card can be repositioned.
    const sprintId = movingTask.sprintId;
    if (!sprintId) return;

    // Measure after render (useEffect runs post-commit).
    const card = document.querySelector<HTMLElement>(`[data-sprint-card="${sprintId}"]`);
    const modal = document.querySelector<HTMLElement>('[data-move-task-modal]');
    if (!card || !modal) return;

    const cardTop = card.getBoundingClientRect().top;
    const desiredTop = modal.getBoundingClientRect().top - 12; // small gap above the modal
    if (cardTop <= desiredTop) return; // header already visible above the modal — no scroll

    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const target = Math.min(window.scrollY + (cardTop - desiredTop), maxScroll);
    if (target > window.scrollY) {
      moveModalScrollYRef.current = window.scrollY;
      window.scrollTo({ top: target, left: 0, behavior: 'auto' });
    }
  }, [movingTask]);

  useEffect(() => {
    if (!rowActionMenu) return;

    const closeOnPointer = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-row-menu]')) return;
      setRowActionMenu(null);
    };
    const closeOnKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowActionMenu(null);
    };
    const closeOnScroll = () => setRowActionMenu(null);

    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnKeyDown);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnKeyDown);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [rowActionMenu]);

  const toggleRowActionMenu = (
    e: React.MouseEvent,
    issue: IterationIssue,
    sprintId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // Close any competing popovers on this page.
    setMoreMenuSprintId(null);
    setStatusDropdownSprintId(null);
    setAssigneesPopoverSprintId(null);
    setBoardDropdownOpen(false);
    setCreateDropdownOpen(false);

    if (rowActionMenu && rowActionMenu.issue.id === issue.id) {
      setRowActionMenu(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - ROW_ACTION_MENU_W - 8));
    const y = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 96));
    setRowActionMenu({ issue, sprintId, x, y });
  };

  const rowActionOpen = () => {
    if (!rowActionMenu) return;
    const { issue, sprintId } = rowActionMenu;
    setRowActionMenu(null);
    handleOpenTask(issue, false, sprintId);
  };

  const rowActionMove = () => {
    if (!rowActionMenu) return;
    const { issue, sprintId } = rowActionMenu;
    setRowActionMenu(null);

    const targetTaskId = resolveIssueTaskId({
      issue,
      projectId,
      sprintId: sprintId || currentSprint.id,
      users,
      currentUser,
    });
    const targetTask = useAppStore.getState().tasks.find((t) => t.id === targetTaskId);
    if (targetTask) setMovingTask(targetTask);
  };

  const handleAddLinkedPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    const newPage: LinkedPage = {
      id: `lp-${Date.now()}`,
      title: newPageTitle.trim(),
      url: newPageUrl.trim() || `https://confluence.enterprise.internal/pages/${encodeURIComponent(newPageTitle)}`,
      space: `${projectKey} Operations`,
      updatedAt: 'Just now'
    };

    setLinkedPages((prev) => [newPage, ...prev]);
    setNewPageTitle('');
    setNewPageUrl('');
    toast.success('Linked page added to iteration');
  };

  // Quick filter name pills
  const displayedFilters = showFewer
    ? projectTeamMembers.slice(0, 10)
    : projectTeamMembers;

  return (
    <div className="space-y-2 animate-fade-in font-sans text-[#172b4d]">
      {/* Unified Iteration Cadence Card (Collaged Top Controls & Iteration Scope) */}
      <div className="bg-white rounded-2xl border border-[#dfe1e6] shadow-xs transition-all">
        {/* Top Agile Header Bar — compact two-row layout:
            Row 1: page title (left) + primary actions (right).
            Row 2: search + member quick filters, single non-wrapping line. */}
        <div className="px-4 py-2">
          {/* Row 1 — title + actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold text-[#172b4d] tracking-tight whitespace-nowrap">
                {isCompletedView ? 'Completed Iterations' : 'Iterations'}
              </h1>
              <span className="text-[11px] text-[#6b778c] truncate hidden sm:inline">
                {project?.name}
              </span>
              {isCompletedView && (
                <button
                  type="button"
                  onClick={() => navigate(iterationsModuleUrl)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0d9488] hover:text-[#0f766e] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Iterations
                </button>
              )}
            </div>

            {/* Right-side actions — [Completed Iterations] [Collapse All]
                [Board ▾] [Create PI] [Create ▾]. Completed Iterations opens
                the PI-grouped history view (`.../iterations/completed`) — the
                same destination the module nav tab used to point at. */}
            <div className="flex items-center gap-2 flex-shrink-0 relative">
              <button
                type="button"
                onClick={() => navigate(`${iterationsModuleUrl}/completed`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#ebecf0] hover:bg-[#dfe1e6] text-[#172b4d] transition-colors border border-transparent shadow-xs cursor-pointer whitespace-nowrap"
                title="View completed iterations"
                aria-label="Completed Iterations"
              >
                <History className="w-3.5 h-3.5 text-[#6b778c]" />
                <span>Completed Iterations</span>
              </button>

              <button
                type="button"
                onClick={collapseAllSprints}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#ebecf0] hover:bg-[#dfe1e6] text-[#172b4d] transition-colors border border-transparent shadow-xs cursor-pointer whitespace-nowrap"
                title="Collapse all iterations"
                aria-label="Collapse all iterations"
              >
                <ChevronsUp className="w-3.5 h-3.5 text-[#6b778c]" />
                <span>Collapse All</span>
              </button>

              <button
                onClick={() => setBoardDropdownOpen(!boardDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#ebecf0] hover:bg-[#dfe1e6] text-[#172b4d] transition-colors border border-transparent shadow-xs whitespace-nowrap"
              >
                <span>Board</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#6b778c]" />
              </button>

              {boardDropdownOpen && (
                <div className="absolute right-0 top-10 w-60 bg-white rounded-xl shadow-xl border border-[#dfe1e6] py-1 z-50 animate-scale-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                    Available Views
                  </div>
                  <button
                    onClick={() => setBoardDropdownOpen(false)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-[#0052cc] bg-[#deebff]/50 flex items-center justify-between"
                  >
                    <span>Iteration Cadence & Scope</span>
                    <Check className="w-3.5 h-3.5 text-[#0052cc]" />
                  </button>
                  <button
                    onClick={() => {
                      setBoardDropdownOpen(false);
                      toast.info(`Switched to ${project?.name} Live Iteration`);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[#172b4d] hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Live Iteration</span>
                  </button>
                </div>
              )}

              {/* Create PI — first step of the Project → PI → Iteration hierarchy */}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowCreatePIModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#ebecf0] hover:bg-[#dfe1e6] text-[#172b4d] transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                  title="Create a parent PI for this project"
                >
                  <ListTree className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Create PI</span>
                </button>
              )}

              {/* Split / Dropdown Create Action */}
              <div className="relative inline-flex items-stretch rounded-md shadow-xs">
                <button
                  onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white transition-colors cursor-pointer whitespace-nowrap"
                  title="Create Iteration or Issue"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
                <button
                  onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                  className="inline-flex items-center px-1.5 py-1.5 rounded-r-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white/90 border-l border-white/20 transition-colors cursor-pointer"
                  title="Choose what to create"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {createDropdownOpen && (
                  <div className="absolute right-0 top-9 w-64 bg-white rounded-xl shadow-2xl border border-[#dfe1e6] py-1.5 z-50 animate-scale-in text-xs">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                      Create in {projectKey} Cadence
                    </div>

                    <button
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        openCreateIteration();
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#deebff]/40 flex items-start gap-2.5 transition-colors group cursor-pointer"
                    >
                      <div className="p-1.5 rounded-md bg-blue-50 text-[#0052cc] group-hover:bg-[#0052cc] group-hover:text-white transition-colors mt-0.5">
                        <CalendarRange className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[#172b4d] group-hover:text-[#0052cc] flex items-center gap-1.5">
                          <span>Create Iteration</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">Iteration</span>
                        </div>
                        <div className="text-[11px] text-[#6b778c] line-clamp-1">
                          Generate an iteration under a PI with dates & goal
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setShowCreatePIModal(true);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#deebff]/40 flex items-start gap-2.5 transition-colors group cursor-pointer border-t border-slate-100"
                    >
                      <div className="p-1.5 rounded-md bg-emerald-50 text-[#0d9488] group-hover:bg-[#0d9488] group-hover:text-white transition-colors mt-0.5">
                        <ListTree className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[#172b4d] group-hover:text-[#0052cc] flex items-center gap-1.5">
                          <span>Create PI</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">PI</span>
                        </div>
                        <div className="text-[11px] text-[#6b778c] line-clamp-1">
                          Add a parent PI that iterations are numbered from
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setIssueTargetSprintId(null);
                        setShowCreateIssueModal(true);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#deebff]/40 flex items-start gap-2.5 transition-colors group cursor-pointer border-t border-slate-100"
                    >
                      <div className="p-1.5 rounded-md bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors mt-0.5">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[#172b4d] group-hover:text-[#0052cc] flex items-center gap-1.5">
                          <span>Create Work Item</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">Work Item</span>
                        </div>
                        <div className="text-[11px] text-[#6b778c] line-clamp-1">
                          Add Story, Task, or Bug to {getSprintIdentifier(currentSprint)}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2 — search + member quick filters, ONE non-wrapping line.
              The pills row scrolls horizontally (overflow-x-auto) instead of
              wrapping, so the toolbar keeps a constant compact height; on
              narrow viewports secondary members collapse behind "...Show more". */}
          <div className="flex items-center gap-2 pt-1 animate-fade-in">
            {/* Search Input — compact ~150px */}
            <div className="relative w-[150px] flex-shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b778c]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories, keys..."
                className="w-full pl-8 pr-2 py-1 text-xs bg-slate-50 border border-[#dfe1e6] rounded-md focus:bg-white focus:border-[#4c9aff] focus:ring-1 focus:ring-[#4c9aff] transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Pills (Populated from this Project's real team members)
                — single line, never wraps: flex-nowrap + overflow-x-auto. */}
            <div className="flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0 flex-1">
              {displayedFilters.map((user) => {
                const isActive = activePersonFilters.includes(user.name);
                return (
                  <button
                    key={user.id}
                    onClick={() => togglePersonFilter(user.name)}
                    className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30 shadow-2xs'
                        : 'text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d]'
                    }`}
                  >
                    {user.name.split(' ')[0]}
                  </button>
                );
              })}

              <button
                onClick={() => setOnlyMyIssues(!onlyMyIssues)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  onlyMyIssues
                    ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                Only My Work Items
              </button>

              <button
                onClick={() => setRecentlyUpdatedOnly(!recentlyUpdatedOnly)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  recentlyUpdatedOnly
                    ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                Recently Updated
              </button>

              {projectTeamMembers.length > 10 && (
                <button
                  onClick={() => setShowFewer(!showFewer)}
                  className="text-[11px] px-1.5 py-0.5 text-[#0052cc] hover:underline font-semibold whitespace-nowrap flex-shrink-0"
                >
                  {showFewer ? '...Show more' : '...Show fewer'}
                </button>
              )}

              {(activePersonFilters.length > 0 || onlyMyIssues || recentlyUpdatedOnly || searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] px-1.5 py-0.5 rounded text-red-600 hover:bg-red-50 font-bold flex items-center gap-0.5 whitespace-nowrap flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Iteration sections — every iteration renders as its own expandable, collapsible card */}
      {projectSprints.length === 0 || !hasVisibleSections ? (
        <div className="bg-white rounded-2xl border border-[#dfe1e6] shadow-xs p-8 text-center">
          <p className="text-sm font-semibold text-[#172b4d]">
            {isCompletedView
              ? 'No completed iterations yet'
              : planSections.completed.length > 0
                ? 'No active or planned iterations'
                : 'No iterations yet'}
          </p>
          <p className="text-xs text-[#6b778c] mt-1">
            {isCompletedView
              ? 'Finished iterations will appear here, grouped under their PI, once they are completed.'
              : projectPis.length === 0
                ? 'Create the parent PI first — iterations are generated inside a PI and numbered from it.'
                : planSections.completed.length > 0
                  ? `All iterations of ${project?.name} are completed — open Completed Iterations to browse the history.`
                  : `Create the first iteration of ${projectPis[0]?.name} for ${project?.name} to start planning.`}
          </p>
          {!isCompletedView &&
            (projectPis.length === 0 ? (
              <button
                onClick={() => setShowCreatePIModal(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-[#0d9488] text-white hover:bg-[#0f766e] text-xs font-bold cursor-pointer"
              >
                + Create PI
              </button>
            ) : (
              <button
                onClick={() => openCreateIteration(projectPis[0]?.id)}
                className="mt-4 px-4 py-2 rounded-lg bg-[#0d9488] text-white hover:bg-[#0f766e] text-xs font-bold cursor-pointer"
              >
                + Create Iteration
              </button>
            ))}
        </div>
      ) : (
        <>
          {/* ACTIVE / PLANNED sections (main page) or COMPLETED (history tab),
              from the centralized per-sprint PI → Sprint plan — the same source
              as the Move Work Item modal. */}
          {overviewSections.map((section) =>
            section.pis.length === 0 ? null : (
              <div key={section.key} className="mb-2">
                {/* Section header — only on the Completed history tab, where it
                    labels the grouped archive. The main page proceeds directly
                    from the toolbar to the iteration cards: each card already
                    carries its PI number, dates and ACTIVE/COMPLETED badge,
                    so the ACTIVE/Current and PI heading rows were redundant. */}
                {isCompletedView && (
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <span className="text-[10px] font-black px-2 py-1 rounded tracking-widest uppercase bg-slate-100 text-slate-600">
                      {section.label}
                    </span>
                  </div>
                )}
                {section.pis.map((pi: PlanPi) => (
                  <div key={pi.id} className="mb-4">
                    {/* PI group header — kept on the Completed history tab so
                        completed sprints stay grouped under their original PI. */}
                    {isCompletedView && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="font-bold text-sm text-[#172b4d]">{pi.name}</span>
                        <span className="text-[11px] text-[#6b778c] font-medium">
                          {pi.startDate} → {pi.endDate}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2.5">
                      {pi.sprints.map((entry) => {
                        const sprint = sprints.find((s) => s.id === entry.id);
                        if (!sprint) return null;
          const issues = getIssuesForSprint(sprint.id);
          const filteredIssues = filterIssues(issues);
          const stats = computeStats(issues);
          const flaggedCount = countFlaggedForSprint(sprint.id);
          const open = isSprintOpen(sprint.id);
          const members = getSprintMembers(sprint);
          const isActive = sprint.status === 'ACTIVE';
          const isCompleted = sprint.status === 'COMPLETED';
          // Row title inside a PI group: PI-based number only ("30.4 [15 SEP - 28 SEP]").
          const title = formatSprintPiTitle(sprint, projectKey, sprintIdentifiers);
          const shortTitle = title.split(' [')[0];
          const statusMenuOpen = statusDropdownSprintId === sprint.id;
          const rowMenuOpen = moreMenuSprintId === sprint.id;
          const assigneesOpen = assigneesPopoverSprintId === sprint.id;

          const closeAllRowUi = () => {
            setMoreMenuSprintId(null);
            setStatusDropdownSprintId(null);
            setAssigneesPopoverSprintId(null);
          };

          // Role-based visibility for this sprint's actions (role resolved once above).
          const showStart = canManage && sprint.status === 'PLANNED';
          const showComplete = canManage && sprint.status === 'ACTIVE';
          const showEdit = canManage && sprint.status !== 'COMPLETED';
          const showArchive =
            canArchive && sprint.status !== 'ACTIVE' &&
            (sprintRole === 'ADMIN' || sprint.status === 'COMPLETED');
          const showDelete = canDelete && sprint.status !== 'ACTIVE';
          const statusBadgeClass = isActive
            ? 'bg-[#00875a] hover:bg-[#006644] text-white'
            : 'bg-slate-600 hover:bg-slate-700 text-white';

          return (
            <div
              key={sprint.id}
              data-sprint-card={sprint.id}
              className="bg-white rounded-xl border border-[#dfe1e6] shadow-xs transition-all"
            >
              {/* Section header: title, issue/flag counts, status, estimation pills, row menu */}
              <div className="px-4 py-2.5 bg-[#fafbfc] rounded-t-xl flex flex-wrap items-center justify-between gap-3 select-none">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleSprintOpen(sprint.id)}
                    className="p-1 -ml-1 rounded hover:bg-[#ebecf0] text-[#6b778c] transition-colors cursor-pointer"
                    title={open ? 'Collapse iteration' : 'Expand iteration'}
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-[#172b4d]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#172b4d]" />
                    )}
                  </button>

                  <span className="font-bold text-sm text-[#172b4d] tracking-tight" title={title}>
                    {title}
                  </span>

                  <span className="text-xs text-[#6b778c] font-medium">
                    {stats.totalIssues} work items
                  </span>

                  {/* Issue/list icon: opens the Issue Search page for this iteration */}
                  <button
                    type="button"
                    onClick={() => navigate(`/pm/issues/search?sprint=${toUrlId(sprint.id)}`)}
                    className="p-0.5 rounded hover:bg-[#deebff] transition-colors flex-shrink-0 cursor-pointer"
                    title="Search work items in this iteration"
                    aria-label="Search iteration work items"
                  >
                    <ListTree className="w-3.5 h-3.5 text-[#4c9aff]" />
                  </button>

                  <div className="flex items-center gap-1 text-xs text-[#6b778c]" title={`${flaggedCount} flagged issue(s)`}>
                    <span>- {flaggedCount}</span>
                    <Flag className="w-3.5 h-3.5 fill-[#0052cc] text-[#0052cc]" />
                  </div>

                  {(isActive || isCompleted) && (
                    <div className="relative">
                      {canManage ? (
                        <button
                          onClick={() => {
                            closeAllRowUi();
                            setSelectedSprintId(sprint.id);
                            setStatusDropdownSprintId(statusMenuOpen ? null : sprint.id);
                          }}
                          className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-2xs flex items-center gap-1 transition-all cursor-pointer ${statusBadgeClass}`}
                          title="Click to toggle iteration status"
                        >
                          <span>{sprint.status}</span>
                          <ChevronDown className="w-3 h-3 text-white/80" />
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-2xs flex items-center gap-1 ${statusBadgeClass}`}
                          title={`Iteration status: ${sprint.status}`}
                        >
                          <span>{sprint.status}</span>
                        </span>
                      )}

                      {canManage && statusMenuOpen && (
                        <div className="absolute left-0 top-7 w-44 bg-white rounded-xl shadow-xl border border-[#dfe1e6] py-1 z-50 animate-scale-in">
                          <div className="px-3 py-1 text-[9px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                            Set Iteration Status
                          </div>
                          {(['ACTIVE', 'COMPLETED', 'PLANNED'] as const).map((st) => (
                            <button
                              key={st}
                              onClick={() => {
                                setStatusDropdownSprintId(null);
                                if (st === 'COMPLETED') {
                                  // Route completion through the existing completion flow
                                  handleCompleteSprint(sprint);
                                } else if (st === 'ACTIVE') {
                                  // Route through the start flow so a second ACTIVE
                                  // iteration can never be created directly (§ single-active)
                                  handleStartSprint(sprint);
                                } else {
                                  updateSprintStatus(sprint.id, st);
                                  toast.success(`${shortTitle} status set to ${st}`);
                                }
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                                sprint.status === st ? 'font-bold text-[#0052cc] bg-[#deebff]/40' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    st === 'ACTIVE' ? 'bg-[#00875a]' : st === 'COMPLETED' ? 'bg-slate-500' : 'bg-blue-500'
                                  }`}
                                />
                                <span>{st}</span>
                              </div>
                              {sprint.status === st && <Check className="w-3.5 h-3.5 text-[#0052cc]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isActive || isCompleted ? (
                    <>
                      <span
                        className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#42526e] text-white"
                        title={`To Do Points: ${stats.todoPoints}`}
                      >
                        {stats.todoPoints}
                      </span>
                      <span
                        className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0052cc] text-white"
                        title={`In Progress Points: ${stats.inProgPoints}`}
                      >
                        {stats.inProgPoints}
                      </span>
                      <span
                        className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#00875a] text-white"
                        title={`Done Points: ${stats.donePoints}`}
                      >
                        {stats.donePoints}
                      </span>
                    </>
                  ) : canManage ? (
                    <button
                      onClick={() => handleStartSprint(sprint)}
                      className="text-xs font-semibold text-[#6b778c] hover:text-[#0052cc] px-2.5 py-1 rounded-md hover:bg-[#deebff] transition-colors cursor-pointer"
                      title="Start this iteration"
                    >
                      Start iteration
                    </button>
                  ) : null}

                  <div className="relative">
                    <button
                      onClick={() => {
                        const next = !rowMenuOpen;
                        closeAllRowUi();
                        setSelectedSprintId(sprint.id);
                        if (next) setMoreMenuSprintId(sprint.id);
                      }}
                      className="p-1.5 rounded hover:bg-[#ebecf0] text-[#6b778c] transition-colors cursor-pointer"
                      title="Iteration Actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {rowMenuOpen && (
                      <div className="absolute right-0 top-7 w-52 bg-white rounded-xl shadow-xl border border-[#dfe1e6] py-1 z-50 animate-scale-in text-xs">
                        <div className="px-3 py-1 text-[9px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                          Iteration Actions
                        </div>

                        {/* Lifecycle actions (TL / PM / ADMIN only) */}
                        {showStart && (
                          <button
                            onClick={() => {
                              setMoreMenuSprintId(null);
                              handleStartSprint(sprint);
                            }}
                            className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold"
                          >
                            <Play className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Start Iteration</span>
                          </button>
                        )}

                        {showComplete && (
                          <button
                            onClick={() => handleCompleteSprint(sprint)}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Complete Iteration</span>
                          </button>
                        )}

                        {showEdit && (
                          <button
                            onClick={() => {
                              setMoreMenuSprintId(null);
                              openEditSprintModal(sprint);
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit Iteration</span>
                          </button>
                        )}

                        {(showStart || showComplete || showEdit) && (
                          <div className="my-1 border-t border-[#ebecf0]" />
                        )}

                        {/* Safe / read-only actions (available to every role) */}
                        <button
                          onClick={() => {
                            setMoreMenuSprintId(null);
                            setSelectedSprintId(sprint.id);
                            setExpandedSprintIds((prev) => ({ ...prev, [sprint.id]: true }));
                          }}
                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Iteration</span>
                        </button>

                        <button
                          onClick={() => {
                            setMoreMenuSprintId(null);
                            setSelectedSprintId(sprint.id);
                            setShowIterationDetailsModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Iteration Details</span>
                        </button>

                        <button
                          onClick={() => {
                            setMoreMenuSprintId(null);
                            setExpandedSprintIds((prev) => ({ ...prev, [sprint.id]: true }));
                          }}
                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                        >
                          <ListTree className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Work Items</span>
                        </button>

                        {/* Administrative actions (existing permission model) */}
                        {showArchive && (
                          <button
                            onClick={() => handleArchiveSprint(sprint)}
                            className="w-full text-left px-3 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-semibold"
                          >
                            <Archive className="w-3.5 h-3.5 text-amber-600" />
                            <span>Archive Iteration</span>
                          </button>
                        )}

                        {showDelete && (
                          <button
                            onClick={() => {
                              setMoreMenuSprintId(null);
                              setSelectedSprintId(sprint.id);
                              setShowDeleteSprintConfirm(true);
                            }}
                            className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 flex items-center gap-2 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Delete Iteration</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-header: member avatars, dates, linked pages */}
              <div className="px-4 py-1.5 bg-white border-t border-[#ebecf0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6b778c]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-1.5 relative">
                    {members.slice(0, 5).map((member) => (
                      <div key={member.id} title={member.name}>
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-6 h-6 rounded-full ring-2 ring-white object-cover shadow-2xs"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-2xs"
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            {member.name[0]}
                          </div>
                        )}
                      </div>
                    ))}

                    {members.length > 5 && (
                      <button
                        onClick={() => setAssigneesPopoverSprintId(assigneesOpen ? null : sprint.id)}
                        className="w-6 h-6 rounded-full bg-[#ebecf0] hover:bg-[#dfe1e6] text-[#172b4d] text-[9px] font-bold flex items-center justify-center ring-2 ring-white transition-colors cursor-pointer"
                        title={`Click to view all ${members.length} iteration members`}
                      >
                        +{members.length - 5}
                      </button>
                    )}

                    {assigneesOpen && (
                      <div className="absolute left-0 top-7 w-64 bg-white rounded-xl shadow-2xl border border-[#dfe1e6] p-3 z-50 animate-scale-in text-left">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#ebecf0]">
                          <span className="font-bold text-xs text-[#172b4d]">
                            {shortTitle} Members ({members.length})
                          </span>
                          <button
                            onClick={() => setAssigneesPopoverSprintId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin text-xs">
                          {members.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 py-0.5">
                              <span
                                className="w-5 h-5 rounded-full text-white font-bold text-[9px] flex items-center justify-center"
                                style={{ backgroundColor: m.avatarColor }}
                              >
                                {m.name[0]}
                              </span>
                              <span className="text-slate-800">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toast.info(`${shortTitle} member roster`)}
                    className="p-1 text-[#6b778c] hover:text-[#172b4d]"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5 font-medium text-[#42526e]">
                    <span>{formatSprintDate(sprint.startDate, '9:00 AM') || sprint.startDate}</span>
                    <span>•</span>
                    <span>{formatSprintDate(sprint.endDate, '6:00 PM') || sprint.endDate}</span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => {
                      setSelectedSprintId(sprint.id);
                      setShowLinkedPagesModal(true);
                    }}
                    className="text-[#0052cc] hover:underline font-semibold flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View linked pages ({linkedPages.length})</span>
                  </button>
                </div>
              </div>

              {/* Expanded issue list (Jira-style rows, strikethrough when done) */}
              {open && (
                <div className="divide-y divide-[#ebecf0] border-t border-[#ebecf0]">
                  {filteredIssues.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs bg-white">
                      No work items match your current filter criteria in this iteration.
                    </div>
                  ) : (
                    filteredIssues.map((issue) => {
                      const isDone = issue.status === 'DONE';
                      const isSelected = selectedIssueIds.includes(issue.id);

                      return (
                        <div
                          key={issue.id}
                          onClick={(e) => {
                            handleOpenTask(issue, e.ctrlKey || e.metaKey, sprint.id);
                          }}
                          className={`group grid grid-cols-[auto_auto_minmax(0,1fr)_104px_24px_28px_28px] sm:grid-cols-[auto_auto_minmax(0,1fr)_104px_88px_24px_28px_28px] md:grid-cols-[auto_auto_minmax(0,1fr)_104px_88px_140px_24px_28px_28px] items-center gap-x-2 px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                            isSelected ? 'bg-[#deebff]/40' : 'hover:bg-[#f4f5f7] bg-white'
                          }`}
                        >
                          {/* Column 1 — checkbox + work-item icon */}
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedIssueIds((prev) =>
                                  prev.includes(issue.id)
                                    ? prev.filter((id) => id !== issue.id)
                                    : [...prev, issue.id]
                                );
                              }}
                              className="rounded border-[#dfe1e6] text-[#0052cc] focus:ring-[#0052cc] cursor-pointer"
                            />

                            <WorkItemIcon typeLabel={issue.type} />
                          </div>

                          {/* Column 2 — priority indicator + issue key */}
                          <div
                            className="flex items-center gap-2 whitespace-nowrap"
                            title={`Priority: ${issue.priority}`}
                          >
                            {issue.priority === 'CRITICAL' ? (
                              <div className="text-red-600 font-black text-xs leading-none">⇈</div>
                            ) : issue.priority === 'HIGH' ? (
                              <div className="text-[#ff5630] font-bold text-xs leading-none">═</div>
                            ) : issue.priority === 'MEDIUM' ? (
                              <div className="text-[#ffab00] font-bold text-xs leading-none">═</div>
                            ) : (
                              <div className="text-[#36b37e] font-bold text-xs leading-none">⇊</div>
                            )}

                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTask(issue, e.ctrlKey || e.metaKey, sprint.id);
                              }}
                              className={`font-semibold tracking-tight whitespace-nowrap text-[#0052cc] hover:underline cursor-pointer ${
                                isDone ? 'line-through' : ''
                              }`}
                              title="Click to open task page"
                            >
                              {issue.key}
                            </span>
                          </div>

                          {/* Column 3 — summary (min-w-0 so long titles truncate
                              instead of pushing the right-hand columns) */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTask(issue, e.ctrlKey || e.metaKey, sprint.id);
                            }}
                            className={`min-w-0 truncate font-medium text-[#172b4d] hover:text-[#0052cc] transition-colors cursor-pointer ${
                              isDone ? 'text-[#42526e]' : ''
                            }`}
                            title={`Click to open task page: ${issue.title}`}
                          >
                            {issue.title}
                          </span>

                          {/* Column 4 — status badge (content-aware width, fixed column) */}
                          <div className="min-w-0">
                            {/* One shared status source: cancelled issues show
                                "Cancelled" here exactly as on the board and detail page. */}
                            <StatusBadge status={issue.status} resolution={issue.resolution} />
                          </div>

                          {/* Column 5 — PI label (hidden below sm, fixed column at sm+) */}
                          <div className="hidden sm:block min-w-0">
                            {issue.releaseTag && (
                              <span className="block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ebecf0] text-[#42526e] border border-[#dfe1e6] truncate">
                                {issue.releaseTag}
                              </span>
                            )}
                          </div>

                          {/* Column 6 — team/category (epic) label (hidden below md) */}
                          <div className="hidden md:block min-w-0">
                            {issue.epicName && (
                              <span
                                className={`block px-2 py-0.5 rounded text-[10px] font-bold truncate border ${issue.epicColor}`}
                                title={issue.epicName}
                              >
                                {issue.epicName}
                              </span>
                            )}
                          </div>

                          {/* Column 7 — assignee avatar */}
                          <div className="flex items-center justify-center" title={`Assignee: ${issue.assigneeName}`}>
                            {issue.avatarUrl ? (
                              <img
                                src={issue.avatarUrl}
                                alt={issue.assigneeName}
                                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div
                                className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-slate-200"
                                style={{ backgroundColor: issue.assigneeAvatarColor }}
                              >
                                {issue.assigneeInitial}
                              </div>
                            )}
                          </div>

                          {/* Column 8 — story-points count badge */}
                          <div className="flex items-center justify-center">
                            <span
                              className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ebecf0] text-[#42526e]"
                              title={`Story points: ${issue.storyPoints}`}
                            >
                              {issue.storyPoints}
                            </span>
                          </div>

                          {/* Column 9 — row actions (⋯): Open / Move Work Item.
                              stopPropagation keeps the row click → Details. */}
                          <div className="flex items-center justify-center">
                            <span className="relative inline-flex" data-row-menu="">
                              <button
                                type="button"
                                onClick={(e) => toggleRowActionMenu(e, issue, sprint.id)}
                                className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                title="Row actions"
                                aria-label={`Actions for ${issue.key || issue.title}`}
                                aria-haspopup="menu"
                                aria-expanded={!!rowActionMenu && rowActionMenu.issue.id === issue.id}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {rowActionMenu && rowActionMenu.issue.id === issue.id && (
                                <div
                                  data-row-menu=""
                                  role="menu"
                                  className="fixed z-50 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in"
                                  style={{ left: rowActionMenu.x, top: rowActionMenu.y }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={rowActionOpen}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                    Open
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={rowActionMove}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                                    Move Work Item
                                  </button>
                                </div>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* In-iteration inline quick create bar */}
                  <div className="px-4 py-2 bg-[#fafbfc] rounded-b-xl flex items-center justify-between">
                    <button
                      onClick={() => {
                        setIssueTargetSprintId(sprint.id);
                        setSelectedSprintId(sprint.id);
                        setShowCreateIssueModal(true);
                      }}
                      className="text-xs font-semibold text-[#0052cc] hover:underline flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create work item in {shortTitle}</span>
                    </button>
                    <span className="text-[11px] text-[#6b778c]">
                      Showing {filteredIssues.length} of {issues.length} work items
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Click-away backdrop closing any open row menu / popover */}
      {(moreMenuSprintId || statusDropdownSprintId || assigneesPopoverSprintId || boardDropdownOpen || createDropdownOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setMoreMenuSprintId(null);
            setStatusDropdownSprintId(null);
            setAssigneesPopoverSprintId(null);
            setBoardDropdownOpen(false);
            setCreateDropdownOpen(false);
          }}
        />
      )}

      {/* Work Queue — compact Jira-style issue list (header + flat rows + inline create);
          main Iterations page only, so the Completed tab stays history-only.
          (Completed history is reachable from the toolbar's "Completed
          Iterations" action — not from a card here.) */}
      {!isCompletedView && (
        <BacklogOverviewTab projectId={projectId} embedded hideEpicsBreakdown compact />
      )}

      {/* Modal: Move Work Item (two-step: form → confirmation) */}
      <MoveTaskModal
        isOpen={!!movingTask}
        task={movingTask}
        onClose={() => setMovingTask(null)}
      />

      {/* Modal: View Linked Pages */}
      {showLinkedPagesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0052cc]" />
                <h3 className="text-base font-bold text-[#172b4d]">Linked Documentation Pages</h3>
              </div>
              <button
                onClick={() => setShowLinkedPagesModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Documentation, runbooks, and PRD specifications linked to <strong>{project?.name} ({sprintDisplayTitle.split(' ')[0]})</strong>.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {linkedPages.map((page) => (
                <div
                  key={page.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#0052cc] transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#0052cc] hover:underline flex items-center gap-1.5"
                    >
                      <span>{page.title}</span>
                      <ExternalLink className="w-3 h-3 text-[#0052cc]" />
                    </a>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Space: {page.space} • Updated {page.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new link form */}
            <form onSubmit={handleAddLinkedPage} className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-800">Add Linked Document</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="e.g. Architecture Signoff Runbook"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  required
                />
                <input
                  type="url"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://confluence.internal/..."
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLinkedPagesModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052cc] text-white hover:bg-[#0747a6]"
                >
                  + Link Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Iteration (shared, PI-aware — Project → PI → Iteration) */}
      <CreateIterationModal
        projectId={projectId}
        isOpen={showCreateSprintModal}
        initialPiId={createIterationPiId}
        onClose={() => setShowCreateSprintModal(false)}
        onCreated={(created) => {
          setSelectedSprintId(created.id);
          setExpandedSprintIds((prev) => ({ ...prev, [created.id]: true }));
        }}
      />

      {/* Modal: Create PI (parent of iterations) */}
      <CreatePIModal
        projectId={projectId}
        isOpen={showCreatePIModal}
        onClose={() => setShowCreatePIModal(false)}
      />

      {/* Modal: Edit Iteration (reuses updateSprint store action) */}
      {showEditSprintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#0052cc]" />
                <div>
                  <h3 className="text-base font-bold text-[#172b4d]">Edit Iteration</h3>
                  <p className="text-[11px] text-slate-500">Update {getSprintIdentifier(currentSprint)} for {project?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditSprintModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSprintSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Iteration Name</label>
                <input
                  type="text"
                  value={editSprintName}
                  onChange={(e) => setEditSprintName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editSprintStartDate}
                    onChange={(e) => setEditSprintStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editSprintEndDate}
                    onChange={(e) => setEditSprintEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Iteration Goal / Deliverables</label>
                <textarea
                  value={editSprintGoal}
                  onChange={(e) => setEditSprintGoal(e.target.value)}
                  placeholder="What is the objective or commitment of this iteration cadence?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditSprintModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0052cc] text-white hover:bg-[#0747a6] font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Iteration Details (compact, read-only, reuses real iteration/user data) */}
      {showIterationDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#0052cc]" />
                <h3 className="text-base font-bold text-[#172b4d]">Iteration Details</h3>
              </div>
              <button
                onClick={() => setShowIterationDetailsModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              {(() => {
                const teamLeader = users.find((u) => u.id === currentSprint.teamLeaderId);
                const createdBy = users.find((u) => u.id === currentSprint.createdById);
                const memberNames = (currentSprint.memberIds || [])
                  .map((id) => users.find((u) => u.id === id)?.name)
                  .filter((n): n is string => Boolean(n));

                const fields: { label: string; value: string | null }[] = [
                  { label: 'Name', value: getSprintIdentifier(currentSprint) || null },
                  { label: 'Status', value: currentSprint.status || null },
                  { label: 'Start Date', value: currentSprint.startDate || null },
                  { label: 'End Date', value: currentSprint.endDate || null },
                  { label: 'Goal', value: currentSprint.goal || null },
                  { label: 'Team Leader', value: teamLeader?.name || null },
                  { label: 'Team Members', value: memberNames.length > 0 ? memberNames.join(', ') : null },
                  { label: 'Created By', value: createdBy?.name || null },
                  {
                    label: 'Created Date',
                    value: currentSprint.createdAt
                      ? new Date(currentSprint.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : null,
                  },
                ];

                return fields.map((f) => (
                  <div key={f.label} className="flex items-start justify-between gap-3 py-1.5 border-b border-[#ebecf0] last:border-0">
                    <span className="text-slate-500 font-medium flex-shrink-0">{f.label}</span>
                    {f.value ? (
                      <span className="text-slate-800 font-semibold text-right break-words">{f.value}</span>
                    ) : (
                      <span className="text-slate-400 italic text-right">Not set</span>
                    )}
                  </div>
                ));
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowIterationDetailsModal(false)}
                className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowIterationDetailsModal(false);
                  openEditSprintModal();
                }}
                className="px-4 py-2 rounded-lg bg-[#0052cc] text-white hover:bg-[#0747a6] font-bold cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Delete Iteration (reuses shared ConfirmDialog + existing deleteSprint action) */}
      <ConfirmDialog
        isOpen={showDeleteSprintConfirm}
        onClose={() => setShowDeleteSprintConfirm(false)}
        onConfirm={handleDeleteSprintConfirmed}
        title="Delete Iteration"
        message={`Are you sure you want to delete "${getSprintIdentifier(currentSprint)}"? Its tasks will be moved back to the project work queue. This action cannot be undone.`}
        confirmLabel="Delete Iteration"
        danger
      />

      {/* Confirm: starting a sprint while another is active (only ONE active iteration) */}
      <ConfirmDialog
        isOpen={!!startConflict}
        onClose={() => setStartConflict(null)}
        onConfirm={handleStartSprintConfirmed}
        title="Start Iteration"
        message={
          startConflict
            ? `Another iteration is already active. Complete it before starting this one? "${getSprintIdentifier(startConflict.active)}" will be completed and "${getSprintIdentifier(startConflict.target)}" will start.`
            : ''
        }
        confirmLabel="Complete & Start"
      />

      {/* Modal: Iteration Completion (existing flow — shows completed/incomplete counts and
          lets incomplete issues move to backlog / a future sprint) */}
      {completingSprint && (
        <SprintCompletionModal
          sprint={completingSprint}
          isOpen={true}
          onClose={() => setCompletingSprint(null)}
          onComplete={() => {
            setExpandedSprintIds((prev) => ({ ...prev, [completingSprint.id]: true }));
          }}
        />
      )}

      {/* Modal: Create Issue */}
      {showCreateIssueModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#0052cc]" />
                <h3 className="text-base font-bold text-[#172b4d]">
                  Create Work Item in {projectKey} Iteration
                </h3>
              </div>
              <button
                onClick={() => setShowCreateIssueModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Issue Summary</label>
                <input
                  type="text"
                  value={newIssueSummary}
                  onChange={(e) => setNewIssueSummary(e.target.value)}
                  placeholder={`e.g. Implement ${project?.name} core feature workflow`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Type</label>
                  <select
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  >
                    <option value="STORY">Story</option>
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Story Points</label>
                  <input
                    type="number"
                    min="1"
                    max="13"
                    value={newIssuePoints}
                    onChange={(e) => setNewIssuePoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Epic / Component</label>
                  <input
                    type="text"
                    value={newIssueEpic}
                    onChange={(e) => setNewIssueEpic(e.target.value)}
                    placeholder="e.g. Core Platform"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assignee</label>
                  <select
                    value={newIssueAssignee}
                    onChange={(e) => setNewIssueAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  >
                    {projectTeamMembers.map((user) => (
                      <option key={user.id} value={user.name}>{user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateIssueModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0052cc] text-white hover:bg-[#0747a6] font-bold"
                >
                  Create Work Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
