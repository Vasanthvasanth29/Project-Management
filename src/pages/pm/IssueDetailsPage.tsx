import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft, ChevronDown, MessageSquare, UserPlus, Pencil, MoreHorizontal,
  GitBranch, X, Check, History, ListChecks, Send, AlertCircle, Ban, RotateCcw, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { RichTextEditor, CommentContent } from '../../components/common/RichTextEditor';
import { isEmptyHtml } from '../../utils/sanitize';
import { getProjectUrl, matchId } from '../../utils/idUtils';
import { resolveTaskByIssueKey, resolveIssueKey } from '../../utils/issueKeyResolver';
import { issuePath } from '../../utils/issueUrl';
import { getStatusColor, getStatusLabel, isCancelledWorkItem } from '../../utils/roleUtils';
import {
  getAllowedInitiativeTransitions, evaluateInitiativeStatusChange, explainInitiativeTransition,
  INITIATIVE_WORKFLOW_CHAIN, initiativeBoardColumn,
} from '../../utils/initiativeWorkflow';
import { formatTransitionDateTime, formatDuration } from '../../utils/statusTransitions';
import {
  IssueDetailsSection,
  PeoplePanel,
  DatesPanel,
  IssueLinks,
  ChildIssueList,
} from '../../components/issues';
import { collectChildRows, type ChildIssueRow } from '../../utils/workItemHierarchy';
import { collectSprintWorkItems, sortProjectSprints } from '../../utils/sprintIssues';
import {
  BOARD_COLUMNS, columnLabel, columnOfStatus, statusForColumn, canTransition, needsComment,
  type BoardColumn,
} from './sprintBoardTransitions';
import { StageNode } from './workflow/nodes/StageNode';
import { StartNode } from './workflow/nodes/StartNode';
import { DoneNode } from './workflow/nodes/DoneNode';
import { AnyNode } from './workflow/nodes/AnyNode';
import { workflowToFlowElements } from './workflow/workflowUtils';
import type { Task, Workflow, Team, User, TimeLog, TaskStatus, StatusTransition, TransitionStatus, InitiativeWorkflowStatus } from '../../types';

const nodeTypes = { stageNode: StageNode, startNode: StartNode, doneNode: DoneNode, anyNode: AnyNode };

// The Activity section's tabs: the combined feed, each source on its own, the
// activity history as a table, and the dedicated status-transition records.
type ActivityTab = 'all' | 'comments' | 'worklog' | 'history' | 'activity' | 'grid' | 'transitions';

const ACTIVITY_TABS: Array<[ActivityTab, string]> = [
  ['all', 'All'],
  ['comments', 'Comments'],
  ['worklog', 'Work Log'],
  ['history', 'History'],
  ['activity', 'Activity'],
  ['grid', 'Grid History'],
  ['transitions', 'Transitions'],
];

// Status badge text, exactly as the board columns spell them (TO DO / IN REVIEW ...).
const STATUS_BADGE_LABEL: Record<TransitionStatus, string> = {
  TODO: 'TO DO',
  IN_PROGRESS: 'IN PROGRESS',
  IN_REVIEW: 'IN REVIEW',
  TESTING: 'TESTING',
  BUG_FIX: 'BUG FIX',
  RETEST: 'RE-TEST',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
  'IN TEAM BACKLOG': 'IN TEAM BACKLOG',
  IMPLEMENT: 'IMPLEMENT',
  FUNNEL: 'FUNNEL',
  BACKLOG: 'BACKLOG',
  ASSESSMENT: 'ASSESSMENT',
  ON_BOARD: 'ON BOARD',
  READY_FOR_DEVELOPMENT: 'READY FOR DEVELOPMENT',
  IN_DEVELOPMENT: 'IN DEVELOPMENT',
  ON_HOLD: 'ON HOLD',
  DEVELOPMENT_COMPLETE: 'DEVELOPMENT COMPLETE',
  READY_FOR_DEPLOYMENT: 'READY FOR DEPLOYMENT',
  DEPLOYMENT: 'DEPLOYMENT',
  VALIDATION: 'VALIDATION',
  COMPLETED: 'COMPLETED',
};

const isTransitionAction = (action: string): boolean => action.toLowerCase().includes('status');

/**
 * Transitions-tab UI fallback (frontend-only): rendered ONLY when the store
 * carries no transition history for the issue, so the tab is always visually
 * populated and never shows an empty state. Real store records always win.
 * Display fixtures — never written to the store or backend.
 */
const FALLBACK_TRANSITIONS: StatusTransition[] = [
  {
    id: 'fallback-transition-1',
    userId: 'u-rahul-kumar',
    userName: 'Rahul Kumar',
    userAvatarColor: '#0f766e',
    fromStatus: 'IN_PROGRESS',
    toStatus: 'DONE',
    changedAt: '2024-10-12T21:30:00',
    sourceEnteredAt: '2024-10-06T06:00:00',
    timeInSourceStatus: '6d 15h 30m',
  },
  {
    id: 'fallback-transition-2',
    userId: 'u-priya-kumar',
    userName: 'Priya Kumar',
    userAvatarColor: '#4338ca',
    fromStatus: 'TODO',
    toStatus: 'IN_PROGRESS',
    changedAt: '2024-10-06T06:00:00',
    sourceEnteredAt: '2024-09-29T15:30:00',
    timeInSourceStatus: '6d 14h 30m',
  },
  {
    id: 'fallback-transition-3',
    userId: 'u-priya-kumar',
    userName: 'Priya Kumar',
    userAvatarColor: '#4338ca',
    fromStatus: 'IN TEAM BACKLOG',
    toStatus: 'TODO',
    changedAt: '2024-09-29T15:30:00',
    sourceEnteredAt: '2024-09-29T14:30:00',
    timeInSourceStatus: '1h',
  },
];

export const IssueDetailsPage: React.FC = () => {
  const { issueKey, taskId } = useParams<{ issueKey?: string; taskId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const {
    tasks, projects, users, teams, workflows, activities, sprints,
    issueStatusTransitions,
    updateTask, updateTaskStatus, assignTask, addComment,
  } = useAppStore();

  // The issue to show always comes from the URL/navigation state - never from a
  // hardcoded key. Two entry shapes render this same canonical component:
  //   - /browse/:issueKey          -> the Jira-style issue key
  //   - /:role/tasks/:issueKey     -> the same Jira-style issue key (My Tasks,
  //     My Iteration, Iterations, Live Iteration, search, dashboards,
  //     notifications, ...) - the URL shape every listing navigates with;
  //     legacy internal-id URLs still resolve as a fallback.
  // There is exactly one issue-detail page; every route below renders this one.
  const locator = issueKey?.trim() || taskId?.trim() || '';

  const [resolved, setResolved] = useState<
    { taskId: string; projectId: string; locator: string; via: 'key' | 'id' } | null
  >(null);
  const [notFoundFor, setNotFoundFor] = useState<string | null>(null);

  // Resolution (and on-demand materialisation of a seed issue into a real task)
  // happens in an effect, never during render, so it never fights React for
  // the current render pass. It re-runs whenever the URL identifier changes, and
  // the resolved ids are tagged with the identifier they were resolved for, so a
  // previously opened issue can never be rendered under the new URL.
  // The identifier is tried as the public issue key first (the shape the app
  // navigates with: ECOMM-500), then as a legacy internal task id.
  useEffect(() => {
    if (!locator) return;
    const byKey = resolveTaskByIssueKey(locator, currentUser);
    if (byKey) {
      setResolved({ taskId: byKey.task.id, projectId: byKey.project.id, locator, via: 'key' });
      setNotFoundFor(null);
      return;
    }
    const target = tasks.find((t) => matchId(t.id, locator));
    const targetProject = target && projects.find((p) => p.id === target.projectId);
    if (target && targetProject) {
      setResolved({ taskId: target.id, projectId: targetProject.id, locator, via: 'id' });
      setNotFoundFor(null);
    } else {
      setNotFoundFor(locator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locator]);

  const current = resolved && resolved.locator === locator ? resolved : null;
  const task = current ? tasks.find((t) => t.id === current.taskId) : undefined;
  const project = current ? projects.find((p) => p.id === current.projectId) : undefined;
  const notFound = notFoundFor === locator;

  // Canonical Jira-style URL: the address bar always carries the issue's own
  // public key (/member/tasks/ECOMM-500), so the URL segment, the key in the
  // header and any copied link agree. Legacy internal-id URLs are replaced in
  // place (replace: true, so Back keeps working), and key URLs are normalised
  // to upper case; once the URL already holds the canonical key this is a
  // no-op, so /browse/ECOMM-510 keeps rendering exactly as before.
  const location = useLocation();
  useEffect(() => {
    if (!task || !project || !current || notFound) return;
    const canonicalKey =
      current.via === 'id' ? resolveIssueKey(project, task) : locator.toUpperCase();
    if (!canonicalKey || canonicalKey === locator) return;
    const segments = location.pathname.split('/');
    segments[segments.length - 1] = canonicalKey;
    const canonical = segments.join('/');
    if (canonical !== location.pathname) navigate(canonical, { replace: true });
  }, [task, project, current, notFound, locator, location.pathname, navigate]);

  // Work Items in Epic — one canonical, dynamically derived list:
  //  1. the epic's real child hierarchy from the store (parentId chain, depth 2
  //     so Stories AND the Tasks under them show, indented), and
  //  2. not-yet-materialised board/seed issues whose Epic Link (epicName) is
  //     this epic — clicking one opens it through its own issue key, which
  //     materialises it through the same resolver the boards already use.
  // Rows therefore update automatically when an issue is created under the
  // epic, its epic/parent changes, or its status/assignee changes.
  const epicChildRows = useMemo<ChildIssueRow[]>(() => {
    if (!task || !project) return [];
    const rows = collectChildRows(tasks, task.id, 2);
    const claimedIds = new Set(rows.map((r) => r.task.id));
    const claimedKeys = new Set(rows.map((r) => resolveIssueKey(project, r.task).toUpperCase()));
    const claimedTitles = new Set(rows.map((r) => r.task.title.trim().toLowerCase()));
    const storeIds = new Set(tasks.map((t) => t.id));
    const extras: ChildIssueRow[] = [];

    sortProjectSprints(sprints, project.id).forEach((sprint) => {
      collectSprintWorkItems({ sprintId: sprint.id, projectId: project.id }).forEach((card) => {
        if (storeIds.has(card.id)) return;
        if ((card.epicName || '').trim().toLowerCase() !== task.title.trim().toLowerCase()) return;
        const key = (card.issueKey || '').toUpperCase();
        if (claimedIds.has(card.id) || (key && claimedKeys.has(key)) ||
            claimedTitles.has(card.title.trim().toLowerCase())) return;
        claimedIds.add(card.id);
        if (key) claimedKeys.add(key);
        claimedTitles.add(card.title.trim().toLowerCase());
        extras.push({ task: card, depth: 1 });
      });
    });

    return [...rows, ...extras];
  }, [task, project, tasks, sprints]);

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [pendingColumn, setPendingColumn] = useState<BoardColumn | null>(null);
  const [transitionComment, setTransitionComment] = useState('');
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | undefined>(undefined);

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState('');

  const [activityTab, setActivityTab] = useState<ActivityTab>('transitions');
  const [commentHtml, setCommentHtml] = useState('');
  const activityComposerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (task && !isEditingDescription) {
      setDescriptionHtml(task.descriptionHtml || task.description || '');
    }
  }, [task?.id, task?.description, task?.descriptionHtml, isEditingDescription]);

  if (!locator) return null;

  if (notFound) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Issue {locator} not found</h2>
        <p className="text-sm text-slate-500 mt-1">No issue with this key exists in this organisation.</p>
        <button className="btn-secondary mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  if (!task || !project) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading issue…</div>;
  }

  const projectTeamIds = new Set(
    teams.filter((t) => project.teamIds.includes(t.id)).flatMap((t) => t.memberIds)
  );
  const assignableUsers = users.filter((u) => projectTeamIds.has(u.id) || u.id === project.projectManagerId);

  const currentColumn = columnOfStatus(task.status);
  const isCancelled = isCancelledWorkItem(task);

  // Initiatives run on the centralised Initiative workflow, not the board
  // column matrix — BACKLOG isn't a board column, so the generic menu would
  // otherwise offer wrong moves (To Do / Done).
  const isInitiative = task.type === 'INITIATIVE';
  const initiativeTransitions = isInitiative
    ? getAllowedInitiativeTransitions(task.status, task.initiativePreviousStatus)
    : [];

  const openByTaskId = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    // Navigate with the target's own Jira-style key (board/seed key when one
    // exists) so the URL, breadcrumb and issue data stay on the same issue.
    navigate(issuePath(target));
  };

  // Opens a row of "Work Items in Epic": store issues by their canonical key;
  // seed issues (not tasks yet) by their own issue key, which materialises
  // them on the detail page through resolveTaskByIssueKey.
  const openEpicChild = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (target) {
      navigate(issuePath(target));
      return;
    }
    const row = epicChildRows.find((r) => r.task.id === id);
    if (row) navigate(issuePath(row.task));
  };

  // ---- Status transitions (existing BoardColumn matrix, reused verbatim) ----
  const applyColumnChange = (to: BoardColumn, resolution?: 'DONE' | 'CANCELLED', commentText = '') => {
    const newStatus = statusForColumn(to);
    const updates: Partial<Task> = { status: newStatus };
    if (to === 'DONE') {
      updates.resolution = resolution || 'DONE';
      updates.resolvedAt = task.resolvedAt || new Date().toISOString();
      updates.completedAt = new Date().toISOString();
    } else {
      updates.resolution = undefined;
      updates.resolvedAt = undefined;
    }
    // One transition record per move: the resolution travels with the status
    // change, so cancelling never writes an intermediate "DONE" record.
    const res = updateTaskStatus(task.id, newStatus, currentUser?.id || '', to === 'DONE' ? resolution || 'DONE' : undefined);
    if (!res.ok) {
      toast.error(res.reason || 'That move is not allowed.');
      return;
    }
    updateTask(task.id, updates);
    if (commentText && !isEmptyHtml(commentText)) {
      addComment(task.id, currentUser?.id || '', commentText, []);
    }
    toast.success(`Moved to ${columnLabel[to]}`);
  };

  const handleStatusOptionClick = (to: BoardColumn) => {
    setShowStatusMenu(false);
    if (!canTransition(currentColumn, to)) return;
    if (needsComment(currentColumn, to)) {
      setPendingColumn(to);
      setTransitionComment('');
      setPendingAssigneeId(task.assigneeId);
    } else {
      applyColumnChange(to);
    }
  };

  // ---- Initiative transitions: offered by the centralised rules, enforced
  // again by the store gate, so no other surface can bypass the workflow ----
  const handleInitiativeTransition = (to: InitiativeWorkflowStatus) => {
    setShowStatusMenu(false);
    const gate = evaluateInitiativeStatusChange(task, to);
    if (!gate.allowed) {
      toast.error(explainInitiativeTransition(task.status, to, task.initiativePreviousStatus));
      return;
    }
    const res = updateTaskStatus(task.id, to, currentUser?.id || '');
    if (res.ok) {
      toast.success(`Moved to ${getStatusLabel(to)}`);
    } else {
      toast.error(res.reason || 'That move is not allowed.');
    }
  };

  const toggleCancelled = () => {
    setShowStatusMenu(false);
    if (isCancelled) {
      updateTask(task.id, {
        status: 'DONE',
        resolution: 'DONE',
        resolvedAt: task.resolvedAt || new Date().toISOString(),
        completedAt: task.completedAt || new Date().toISOString(),
      }, currentUser?.id || '');
    } else {
      // Cancelled is a real status of its own - never DONE + resolution.
      updateTask(task.id, {
        status: 'CANCELLED',
        resolution: undefined,
        resolvedAt: undefined,
        completedAt: undefined,
      }, currentUser?.id || '');
    }
    toast.success(isCancelled ? 'Restored to Done' : 'Marked as Cancelled');
  };

  const confirmPendingTransition = () => {
    if (!pendingColumn) return;
    applyColumnChange(pendingColumn, undefined, transitionComment);
    // Jira-style transition dialog: the assignee chosen with the transition is
    // applied in the same action, keeping Activity/assignee views in sync.
    if (pendingAssigneeId !== task.assigneeId) {
      assignTask(task.id, pendingAssigneeId || '', currentUser?.id || '');
    }
    setPendingColumn(null);
    setTransitionComment('');
    setPendingAssigneeId(undefined);
  };

  // ---- Description edit (same mechanism as the existing task detail page) ----
  const handleSaveDescription = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = descriptionHtml;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    updateTask(task.id, { description: plainText.trim() || task.description, descriptionHtml });
    setIsEditingDescription(false);
    toast.success('Description updated');
  };

  // ---- Add comment (existing comment functionality, surfaced via the Activity "All" tab) ----
  const focusCommentComposer = () => {
    setActivityTab('all');
    requestAnimationFrame(() => {
      activityComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (activityComposerRef.current?.querySelector('.ProseMirror') as HTMLElement | null)?.focus();
    });
  };

  const submitComment = () => {
    if (isEmptyHtml(commentHtml) || !currentUser) return;
    addComment(task.id, currentUser.id, commentHtml, []);
    setCommentHtml('');
    toast.success('Comment added');
  };

  // ---- Activity feed: All / Comments / Work Log / History / Activity / Grid History / Transitions ----
  const taskActivities = activities.filter((a) => a.entityId === task.id);
  const timeLogs = task.timeLogs || [];
  // Status transition records: the Task's own history plus any records still
  // keyed by this issue in the shared override map, deduplicated and shown
  // newest first. Real store history always wins; when the store has none for
  // this issue, the Transitions tab falls back to FALLBACK_TRANSITIONS so the
  // UI is never empty. Consumed only by the Transitions tab below.
  const statusTransitions = (() => {
    const merged = new Map<string, StatusTransition>();
    (task.statusTransitions || []).forEach((t) => merged.set(t.id, t));
    (issueStatusTransitions[task.id] || []).forEach((t) => merged.set(t.id, t));
    const records = Array.from(merged.values()).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    return records.length > 0 ? records : FALLBACK_TRANSITIONS;
  })();
  type FeedEntry = { id: string; createdAt: string; node: React.ReactNode };

  const buildCommentEntry = (comment: Task['comments'][number]): FeedEntry => {
    const author = users.find((u) => u.id === comment.userId);
    return {
      id: `c-${comment.id}`,
      createdAt: comment.createdAt,
      node: (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e5ea]">
          <Avatar name={author?.name || 'User'} color={author?.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs font-semibold text-slate-800">{author?.name || 'Unknown user'}</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <CommentContent html={comment.content} />
          </div>
        </div>
      ),
    };
  };

  const buildActivityEntry = (activity: (typeof taskActivities)[number]): FeedEntry => {
    const actor = users.find((u) => u.id === activity.userId);
    return {
      id: `a-${activity.id}`,
      createdAt: activity.createdAt,
      node: (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#e2e5ea]">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            {isTransitionAction(activity.action) ? <GitBranch className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{actor?.name || 'System'}</span> {activity.action}
            </p>
            <p className="text-[10px] text-slate-400">{new Date(activity.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ),
    };
  };

  const buildWorkLogEntry = (log: TimeLog): FeedEntry => {
    const author = users.find((u) => u.id === log.userId);
    return {
      id: `tl-${log.id}`,
      createdAt: log.createdAt,
      node: (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e5ea]">
          <Avatar name={author?.name || 'User'} color={author?.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs text-slate-700">
                <span className="font-semibold text-slate-800">{author?.name || 'Unknown user'}</span> logged{' '}
                <span className="font-semibold text-slate-900">{log.hours}h</span>
              </span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTransitionDateTime(log.createdAt)}</span>
            </div>
            {log.description && <p className="text-xs text-slate-500">{log.description}</p>}
          </div>
        </div>
      ),
    };
  };

  // When the issue entered the source status of a record: the timestamp the
  // record itself carries (`sourceEnteredAt`, written when the transition was
  // recorded), else the previous record's timestamp, else the issue's creation
  // for the first one - so every view recomputes the same value from real
  // timestamps instead of trusting a fixed string.
  const sourceEnteredAtFor = (transition: StatusTransition): string => {
    if (transition.sourceEnteredAt) return transition.sourceEnteredAt;
    const chronological = [...(task.statusTransitions || [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const position = chronological.findIndex((t) => t.id === transition.id);
    return position > 0 ? chronological[position - 1].changedAt : task.createdAt;
  };

  const timeInSourceStatusFor = (transition: StatusTransition): string => {
    const startedAt = new Date(sourceEnteredAtFor(transition)).getTime();
    const changedAt = new Date(transition.changedAt).getTime();
    if (Number.isNaN(startedAt) || Number.isNaN(changedAt) || changedAt < startedAt) return transition.timeInSourceStatus;
    return formatDuration(changedAt - startedAt);
  };

  // Compact Jira-style status label: 11px text, 8px/4px padding, 18px line
  // height (~22px tall), slight rounding — existing status colors and labels,
  // no changes to the underlying status values.
  const transitionPill = (status: TransitionStatus): React.ReactNode => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] leading-[18px] font-bold uppercase tracking-wide ${getStatusColor(status)}`}
      data-testid="transition-status"
    >
      {STATUS_BADGE_LABEL[status]}
    </span>
  );

  // Row content of a transition record — the Jira-style hierarchy:
  //   [avatar] <user> made transition - <date/time>        (line 1, ~14px)
  //            FROM → TO                                   (line 2, below)
  const renderTransitionDetails = (transition: StatusTransition): React.ReactNode => (
    <div className="flex items-start gap-2.5 min-w-0" data-testid="transition-record">
      <Avatar
        name={transition.userName || 'System'}
        color={transition.userAvatarColor}
        size="sm"
        imageUrl={transition.userAvatar}
      />
      <div className="min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-slate-900">{transition.userName}</span>{' '}
          <span className="font-normal text-slate-500">
            made transition -{' '}
            <span className="tabular-nums">{formatTransitionDateTime(transition.changedAt)}</span>
          </span>
        </p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {transitionPill(transition.fromStatus)}
          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
          {transitionPill(transition.toStatus)}
        </div>
      </div>
    </div>
  );

  const feedFor = (tab: ActivityTab): FeedEntry[] => {
    const entries: FeedEntry[] =
      tab === 'all'
        ? [
            ...task.comments.map(buildCommentEntry),
            ...taskActivities.map(buildActivityEntry),
            ...timeLogs.map(buildWorkLogEntry),
          ]
        : tab === 'comments'
        ? task.comments.map(buildCommentEntry)
        : tab === 'worklog'
        ? timeLogs.map(buildWorkLogEntry)
        : tab === 'activity'
        ? [...task.comments.map(buildCommentEntry), ...taskActivities.map(buildActivityEntry)]
        : tab === 'history' || tab === 'grid'
        ? taskActivities.map(buildActivityEntry)
        : [];
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  const activityFeed = feedFor(activityTab);
  const gridRows = [...taskActivities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tabLabel = ACTIVITY_TABS.find(([key]) => key === activityTab)?.[1] || 'All';
  const emptyLabel =
    activityTab === 'transitions'
      // The Transitions tab renders its own compact empty state inside the
      // ~700px content column (never stretched across the Activity width).
      ? ''
      : activityTab === 'grid'
      ? gridRows.length === 0
        ? `Nothing to show in ${tabLabel} yet.`
        : ''
      : activityFeed.length === 0
      ? `Nothing to show in ${tabLabel} yet.`
      : '';

  // ---- Workflow visualisation (reuses the real workflow builder data/renderer) ----
  const workflow = workflows.find((w) => w.id === project.workflowId);

  const assignee = users.find((u) => u.id === task.assigneeId);

  // The public display key is the canonical Jira-style key of the issue the URL
  // points at: the requested key when the URL already carries a key, otherwise
  // the issue's OWN key resolved from a legacy internal-id URL (which the
  // canonicalising redirect above is replacing with this very key, so the
  // header and the address bar always agree). The internal Task id is never a
  // display key - it must never replace the issue key here, otherwise ECOMM-501
  // could render as a different, unrelated key.
  const issueKeyDisplay =
    current?.via === 'id' || !issueKey
      ? resolveIssueKey(project, task)
      : issueKey.trim().toUpperCase();

  return (
    <div className="space-y-4 animate-fade-in w-full" onClick={() => { setShowStatusMenu(false); setShowMoreMenu(false); setShowAssignMenu(false); }}>
      {/* Breadcrumb: [project icon] Project name / Issue key */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-[#0052cc] text-[9px] font-bold uppercase leading-none text-white"
          aria-hidden="true"
        >
          {(project.key || project.name).slice(0, 2)}
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => currentUser && navigate(getProjectUrl(project, currentUser.role))}
            className="truncate font-semibold text-slate-600 hover:text-[#0052cc] hover:underline cursor-pointer"
          >
            {project.name}
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(`${window.location.origin}${location.pathname}`)
                .then(() => toast.success('Issue link copied'));
            }}
            className="font-mono font-semibold text-[#0052cc] hover:underline cursor-pointer"
            title="Copy link to this issue"
          >
            {issueKeyDisplay}
          </button>
        </div>
      </nav>

      {/* Title (no work-item type badge) */}
      <div className="flex items-start gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900 leading-snug break-words flex-1 min-w-0">
          {task.title}
        </h1>
      </div>

      {/* Action buttons + status */}
      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => { setIsEditingDescription(true); requestAnimationFrame(() => document.getElementById('issue-description-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>

        <button
          type="button"
          onClick={focusCommentComposer}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Add comment
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAssignMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Assign
          </button>
          {showAssignMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => { updateTask(task.id, { assigneeId: undefined }); setShowAssignMenu(false); toast.success('Unassigned'); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
              >
                Unassigned
              </button>
              {assignableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { assignTask(task.id, u.id, currentUser?.id || ''); setShowAssignMenu(false); toast.success(`Assigned to ${u.name}`); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 ${task.assigneeId === u.id ? 'bg-[#deebff] font-bold text-[#0747a6]' : 'text-slate-700'}`}
                >
                  <Avatar name={u.name} color={u.avatarColor} size="xs" />
                  <span className="truncate">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" /> More <ChevronDown className="w-3 h-3" />
          </button>
          {showMoreMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in">
              <button
                type="button"
                onClick={() => { setShowMoreMenu(false); setShowWorkflowModal(true); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <GitBranch className="w-3.5 h-3.5 text-slate-500" /> View workflow
              </button>
            </div>
          )}
        </div>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowStatusMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#0052cc] hover:bg-[#0747a6] transition-colors cursor-pointer"
          >
            {isCancelled
              ? 'Cancelled'
              : isInitiative
                ? getStatusLabel(task.status)
                : columnLabel[currentColumn]}{' '}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in">
              <div className="px-3 py-1 text-[9px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100 mb-1">
                Valid transitions
              </div>
              {isInitiative ? (
                <>
                  {initiativeTransitions.map((to) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => handleInitiativeTransition(to)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {task.status === 'ON_HOLD' ? `Resume to ${getStatusLabel(to)}` : getStatusLabel(to)}
                    </button>
                  ))}
                  {initiativeTransitions.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-slate-400 italic">No valid transitions</p>
                  )}
                </>
              ) : (
                <>
                  {BOARD_COLUMNS.filter((c) => canTransition(currentColumn, c)).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleStatusOptionClick(c)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      {columnLabel[c]}
                      {needsComment(currentColumn, c) && <MessageSquare className="w-3 h-3 text-slate-400" />}
                    </button>
                  ))}
                  {currentColumn === 'DONE' && (
                    <button
                      type="button"
                      onClick={toggleCancelled}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      {isCancelled ? <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> : <Ban className="w-3.5 h-3.5 text-slate-500" />}
                      {isCancelled ? 'Restore to Done' : 'Mark as Cancelled'}
                    </button>
                  )}
                  {BOARD_COLUMNS.filter((c) => canTransition(currentColumn, c)).length === 0 && currentColumn !== 'DONE' && (
                    <p className="px-3 py-2 text-[11px] text-slate-400 italic">No valid transitions</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail grid: main column (2/3) + People/Dates sidebar (1/3).
          The main wrapper holds EVERYTHING that stacks vertically —
          Information, Description, Work Items in Epic, Related Work Items
          and Activity — so the grid row height follows the main column's
          content and no dead band ever appears below Description; the
          sidebar simply ends where its content ends. Below lg the wrapper
          dissolves (display:contents) and the order utilities keep the
          stacking Information → People/Dates → Description → Epic →
          Related → Activity. All heights stay content-driven: no
          min-height, fixed height, stretch, or spacer elements. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="contents lg:block lg:col-span-2 lg:space-y-4">
          <div className="order-1">
            <IssueDetailsSection task={task} onOpenIssue={openByTaskId} />
          </div>

          {/* Description — follows Information immediately on desktop. */}
          <div id="issue-description-section" className="order-3 w-full max-w-none bg-white rounded-2xl border border-[#e2e5ea] overflow-hidden shadow-fe-xs">
            <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e5ea]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1a1d23]">Description</h3>
            </div>
            <div className="p-4">
              {isEditingDescription ? (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                    <RichTextEditor content={descriptionHtml} onChange={setDescriptionHtml} placeholder="Describe this issue..." minHeight="140px" autoFocus mentionableUsers={assignableUsers} />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setIsEditingDescription(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSaveDescription} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700">
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                </div>
              ) : descriptionHtml && !isEmptyHtml(descriptionHtml) ? (
                <div
                  onClick={() => setIsEditingDescription(true)}
                  className="text-sm text-slate-800 leading-relaxed p-2 -m-2 rounded-xl hover:bg-slate-50 cursor-pointer max-w-none"
                  title="Click to edit description"
                >
                  <CommentContent html={descriptionHtml} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(true)}
                  className="w-full py-6 text-center border border-dashed border-slate-200 hover:border-blue-300 rounded-xl text-xs text-slate-500 hover:text-blue-600 transition-colors"
                >
                  No description. Click to add one.
                </button>
              )}
            </div>
          </div>

          {/* Work Items in Epic: child Stories/Tasks/Bugs/Improvements whose Epic Link is this
              Epic (parentId → this task). Epic-only — distinct from Related Work Items below,
              which shows explicit issue-to-issue links (blocks / relates to / clones). */}
          {task.type === 'EPIC' && (
            <div className="order-4">
              <ChildIssueList
                title="Work Items in Epic"
                rows={epicChildRows}
                onOpen={openEpicChild}
                emptyMessage="No work items in this epic."
              />
            </div>
          )}

          {/* Related Work Items (issue-to-issue links) */}
          <div className="order-5">
            <IssueLinks task={task} onOpen={openByTaskId} />
          </div>

          {/* Activity: All | Comments | Work Log | History | Activity | Grid History | Transitions */}
          <div className="order-6 bg-white rounded-2xl border border-[#e2e5ea] overflow-hidden shadow-fe-xs">
            <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e5ea] flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1a1d23]">Activity</h3>
              <div className="flex items-center gap-1 bg-[#f1f5f9] p-0.5 rounded-lg flex-wrap">
                {ACTIVITY_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityTab(key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      activityTab === key ? 'bg-white text-[#0f766e] border border-[#99f6e4] shadow-fe-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {activityTab === 'all' && (
                <div ref={activityComposerRef} className="space-y-2 pb-3 border-b border-slate-100">
                  <RichTextEditor content={commentHtml} onChange={setCommentHtml} onSubmit={submitComment} placeholder="Write a comment..." mentionableUsers={assignableUsers} />
                  <div className="flex justify-end">
                    <button type="button" onClick={submitComment} disabled={isEmptyHtml(commentHtml)} className="btn-primary btn-sm">
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                </div>
              )}

              {emptyLabel ? (
                <p className="text-xs text-slate-400 text-center py-4 flex items-center justify-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" /> {emptyLabel}
                </p>
              ) : activityTab === 'transitions' ? (
                /* Compact Jira-style Activity → Transitions feed (frontend only).
                   NO card/border/shadow around the list — just the Activity
                   section, a compact left-aligned content column capped at 700px
                   (680-700 target; the empty space to its right is intentional),
                   header + rows + comment composer all sharing that width.
                   Grid `1fr + 200px`: "Time In Source Status" and every duration
                   start at the same x in the right portion of the ~700px column
                   (~71% across), so durations sit close to the transition content
                   — never at the Activity/page edge, no absolute positioning.
                   ~66px rows (10px padding), 32px avatar, ~14px first line with
                   pills on the second line, design-system status badges, thin 1px
                   dividers between rows and a closing divider above the composer.
                   Real store history first, then FALLBACK_TRANSITIONS — never an
                   empty state. Below sm the grid stacks (no horizontal overflow). */
                <div className="w-full max-w-[700px] space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_200px] max-sm:grid-cols-1">
                    <div className="pb-2 border-b border-[#e2e5ea] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Transition
                    </div>
                    <div className="pb-2 border-b border-[#e2e5ea] text-[11px] font-bold text-slate-500 whitespace-nowrap">
                      Time In Source Status
                    </div>

                    {statusTransitions.map((transition) => (
                      <React.Fragment key={transition.id}>
                        <div className="flex items-center py-2.5 border-b border-[#eef0f3]">
                          {renderTransitionDetails(transition)}
                        </div>
                        <div className="flex items-center py-2.5 border-b border-[#eef0f3]">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                            {timeInSourceStatusFor(transition)}
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Comment composer below the transitions (same functionality as All) */}
                  <div className="space-y-2">
                    <RichTextEditor
                      content={commentHtml}
                      onChange={setCommentHtml}
                      onSubmit={submitComment}
                      placeholder="Add a comment..."
                      mentionableUsers={assignableUsers}
                    />
                    <div className="flex justify-end">
                      <button type="button" onClick={submitComment} disabled={isEmptyHtml(commentHtml)} className="btn-primary btn-sm">
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : activityTab === 'grid' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-[#e2e5ea]">
                    <thead>
                      <tr className="bg-[#f8fafc] text-left text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 font-bold">When</th>
                        <th className="px-3 py-2 font-bold">Who</th>
                        <th className="px-3 py-2 font-bold">Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridRows.map((activity) => {
                        const actor = users.find((u) => u.id === activity.userId);
                        return (
                          <tr key={activity.id} className="border-t border-[#eef0f3]">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatTransitionDateTime(activity.createdAt)}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{actor?.name || 'System'}</td>
                            <td className="px-3 py-2 text-slate-700">{activity.action}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">{activityFeed.map((entry) => <React.Fragment key={entry.id}>{entry.node}</React.Fragment>)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar: People + Dates only. Related Work Items and
            Activity live in the main column above, so the grid row height
            follows content and nothing is left blank below Description. */}
        <div className="order-2 space-y-3.5">
          <PeoplePanel task={task} />
          <DatesPanel task={task} />
        </div>
      </div>

      {/* Jira-style transition dialog: New Status + Assignee + Comment */}
      {pendingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setPendingColumn(null)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${getStatusColor(statusForColumn(pendingColumn))}`}>
                  {columnLabel[pendingColumn]}
                </span>
              </div>
              <button type="button" onClick={() => setPendingColumn(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Assignee
                </label>
                <select
                  value={pendingAssigneeId || ''}
                  onChange={(e) => setPendingAssigneeId(e.target.value || undefined)}
                  className="input text-xs py-2"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Comment <span className="font-normal normal-case text-slate-400">(optional)</span>
                </label>
                <RichTextEditor content={transitionComment} onChange={setTransitionComment} placeholder="Add a comment (optional)..." minHeight="88px" autoFocus mentionableUsers={assignableUsers} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
              <button type="button" onClick={() => setPendingColumn(null)} className="btn-secondary btn-sm text-xs">Cancel</button>
              <button type="button" onClick={confirmPendingTransition} className="btn-primary btn-sm text-xs">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* View workflow modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowWorkflowModal(false)}>
          <div className="w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#0052cc]" />
                {isInitiative
                  ? 'Initiative Workflow'
                  : workflow
                    ? workflow.name
                    : `${project.name} — Default Workflow`}
              </h3>
              <button type="button" onClick={() => setShowWorkflowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {isInitiative ? (
                <InitiativeWorkflowDiagram status={task.status} previousStatus={task.initiativePreviousStatus} />
              ) : workflow ? (
                <WorkflowDiagram workflow={workflow} teams={teams} users={users} />
              ) : (
                <DefaultTransitionDiagram />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkflowDiagram: React.FC<{ workflow: Workflow; teams: Team[]; users: User[] }> = ({ workflow, teams, users }) => {
  const { nodes, edges } = useMemo(() => workflowToFlowElements(workflow, teams, users, null), [workflow, teams, users]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
};

// Shown when a project has no dedicated Workflow record: a literal, read-only
// rendering of the same TO DO / IN PROGRESS / DONE matrix that governs the
// Live Iteration board (sprintBoardTransitions.ts) — never a fabricated flow.
const DefaultTransitionDiagram: React.FC = () => (
  <div className="h-full flex items-center justify-center p-8">
    <div className="flex items-center gap-4">
      {BOARD_COLUMNS.map((col, idx) => (
        <React.Fragment key={col}>
          <div className="px-5 py-3 rounded-xl border-2 border-[#0052cc] bg-[#deebff] text-[#0747a6] font-bold text-sm">
            {columnLabel[col]}
          </div>
          {idx < BOARD_COLUMNS.length - 1 && <span className="text-slate-400 text-lg">&#8594;</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

/**
 * Read-only rendering of the Initiative workflow: the linear 10-stage chain
 * with the current stage highlighted, the On Hold side branch (with its resume
 * target) and the terminal Completed state.
 */
const InitiativeWorkflowDiagram: React.FC<{
  status: TaskStatus;
  previousStatus?: InitiativeWorkflowStatus;
}> = ({ status, previousStatus }) => {
  const onHold = status === 'ON_HOLD';
  const activeStatus = onHold
    ? undefined
    : initiativeBoardColumn(status);
  const activeIdx = activeStatus ? INITIATIVE_WORKFLOW_CHAIN.indexOf(activeStatus) : -1;
  const pausedFrom = onHold && previousStatus ? initiativeBoardColumn(previousStatus) : undefined;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {INITIATIVE_WORKFLOW_CHAIN.map((s, i) => {
          const isCurrent = !onHold && s === activeStatus;
          const isPausedSource = onHold && pausedFrom !== undefined && s === pausedFrom;
          const isPast = activeIdx >= 0 && i < activeIdx;
          const isTerminal = s === 'COMPLETED';
          return (
            <React.Fragment key={s}>
              <div
                className={`px-4 py-2.5 rounded-xl border-2 text-xs font-bold text-center ${
                  isCurrent
                    ? 'border-[#0052cc] bg-[#deebff] text-[#0747a6] shadow-md'
                    : isPausedSource
                      ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-md'
                      : isPast
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <div>{getStatusLabel(s)}</div>
                <div className="text-[9px] font-bold uppercase tracking-wide mt-0.5">
                  {isCurrent ? (
                    <span className="text-[#0052cc]">Current stage</span>
                  ) : isPausedSource ? (
                    <span className="text-amber-600">Paused here</span>
                  ) : isTerminal ? (
                    <span className="text-slate-400">Terminal</span>
                  ) : isPast ? (
                    <span className="text-emerald-500">Done</span>
                  ) : (
                    <span className="text-slate-300">Pending</span>
                  )}
                </div>
              </div>
              {i < INITIATIVE_WORKFLOW_CHAIN.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* On Hold side branch */}
      <div
        className={`rounded-xl border-2 border-dashed p-4 ${
          onHold ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold ${
              onHold ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-300 bg-white text-slate-500'
            }`}
          >
            On Hold
            {onHold && <span className="block text-[9px] font-bold uppercase tracking-wide">Current stage</span>}
          </span>
          <ArrowRight className="w-4 h-4 text-slate-300" />
          <span className="text-xs text-slate-600 leading-relaxed">
            {onHold
              ? pausedFrom
                ? `Paused from ${getStatusLabel(pausedFrom)} — the only move is back to ${getStatusLabel(pausedFrom)}.`
                : 'Paused — no stage recorded to resume to.'
              : 'Entered from Assessment through Validation; it always resumes to the exact stage it was paused from. Never available from Backlog or Completed.'}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Initiatives advance exactly one stage forward or back per move. Completed is final.
      </p>
    </div>
  );
};
