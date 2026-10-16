import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, LayoutGrid, Users, X, MessageSquare, Trash2, Ban, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { RichTextEditor } from '../../components/common/RichTextEditor';
import { getPriorityDotColor, isCancelledWorkItem } from '../../utils/roleUtils';
import { getIssueKeyPrefix } from '../../utils/projectIdentity';
import { piNumberForSprint } from '../../utils/programIncrement';
import type { Comment, Project, Task, TaskStatus } from '../../types';
import {
  sortProjectSprints,
  buildProjectTeamMembers,
  buildSprintIssuesMap,
  type IterationIssue,
} from '../../utils/sprintIssues';
import { useIterationPaths } from './IterationModuleLayout';
import {
  BOARD_COLUMNS,
  columnLabel,
  columnOfStatus,
  statusForColumn,
  canTransition,
  isValidDropTarget,
  needsComment,
  type BoardColumn,
} from './sprintBoardTransitions';

interface ActiveSprintPageProps {
  project: Project;
}

type FilterMode = 'my' | 'all' | 'recent';

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'my', label: 'Only My Work Items' },
  { id: 'all', label: 'All Work Items' },
  { id: 'recent', label: 'Recently Updated' },
];

const COLUMN_DOTS: Record<BoardColumn, string> = {
  TODO: 'bg-[#6b778c]',
  IN_PROGRESS: 'bg-[#0052cc]',
  DONE: 'bg-[#00875a]',
};

// The two drag-only drop targets revealed inside the DONE column.
type DoneZone = 'CANCELLED' | 'DONE';

const issueStatusClass = (status: string): string => {
  switch (status) {
    case 'DONE':
      return 'bg-[#e3fcef] text-[#00875a]';
    case 'IN_PROGRESS':
      return 'bg-[#deebff] text-[#0052cc]';
    case 'IN_REVIEW':
      return 'bg-[#eae6ff] text-[#5e4db2]';
    case 'TESTING':
      return 'bg-[#fff7d6] text-[#974f0c]';
    case 'BUG_FIX':
      return 'bg-[#ffeceb] text-[#bf2600]';
    case 'RETEST':
      return 'bg-[#fff0e6] text-[#a54800]';
    case 'BLOCKED':
      return 'bg-[#ffeceb] text-[#bf2600]';
    default:
      return 'bg-[#f1f2f4] text-[#42526e]';
  }
};

const issueStatusLabel = (status: string): string => {
  switch (status) {
    case 'TODO':
      return 'To Do';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'IN_REVIEW':
      return 'In Review';
    case 'BUG_FIX':
      return 'Bug Fix';
    case 'RETEST':
      return 'Retest';
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
};

const typeLabel = (type: string): string =>
  type === 'SUB-TASK' ? 'Sub-task' : type === 'BUG_FIX' ? 'Bug' : type === 'EPIC' ? 'Epic' : type === 'BUG' ? 'Bug' : type === 'TASK' ? 'Task' : type === 'STORY' ? 'Story' : type;

// Compact card-only abbreviation for the issue type badge in the bottom metadata row.
const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  EPIC: { label: 'EP', className: 'bg-purple-100 text-purple-800' },
  STORY: { label: 'ST', className: 'bg-emerald-100 text-emerald-800' },
  TASK: { label: 'TA', className: 'bg-blue-100 text-blue-800' },
  BUG: { label: 'BG', className: 'bg-red-100 text-red-800' },
  BUG_FIX: { label: 'BG', className: 'bg-red-100 text-red-800' },
};

const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
};

// Compact Jira-style sprint date range for the header: "29 SEP - 12 OCT".
const fmtRange = (startIso?: string, endIso?: string): string => {
  const short = (iso?: string): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`;
  };
  const from = short(startIso);
  const to = short(endIso);
  if (!from || !to) return `${fmtDate(startIso)} - ${fmtDate(endIso)}`;
  return `${from} - ${to}`;
};

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Comment bodies come from the rich text editor as HTML. An empty editor serialises
// to "<p></p>", so tags are stripped to decide whether the user actually wrote
// anything — a comment (and a screenshot) are always optional.
const isBlankHtml = (html: string): boolean => {
  const withoutImages = html.replace(/<img\b[^>]*>/gi, '');
  return withoutImages
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim().length === 0;
};

const buildCommentContent = (html: string, image: string | null): string => {
  const body = html && !isBlankHtml(html) ? html.trim() : '';
  const imagePart = image ? `<img src="${image}" alt="Pasted screenshot" />` : '';
  if (body && imagePart) return `${body}<br/>${imagePart}`;
  return body || imagePart;
};

const makePasteAttachment = (image: string): Comment['attachments'][number] => {
  const comma = image.indexOf(',');
  const bytes = comma >= 0 ? Math.max(1, Math.round((image.length - comma - 1) * 0.75)) : image.length;
  return {
    fileId: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: 'pasted-screenshot.png',
    fileSize: bytes,
    fileType: 'image/png',
    attachedAt: new Date().toISOString(),
  };
};

export const ActiveSprintPage: React.FC<ActiveSprintPageProps> = ({ project }) => {
  const navigate = useNavigate();
  const { basePath } = useIterationPaths();
  const {
    sprints, pis, tasks, users, teams, updateTask, addComment, assignTask,
    issueStatusOverrides, issueResolutions, issueComments,
    setIssueStatusOverride, setIssueResolutionOverride, addIssueComment,
    setIssueAssigneeOverride,
  } = useAppStore();
  const { currentUser } = useAuthStore();

  const projectSprints = useMemo(() => sortProjectSprints(sprints, project.id), [sprints, project.id]);
  const activeSprint = useMemo(() => projectSprints.find((s) => s.status === 'ACTIVE'), [projectSprints]);
  // Project → PI → Iteration: the PI this live iteration belongs to.
  const activePiNumber = useMemo(
    () => (activeSprint ? piNumberForSprint(activeSprint, pis) : undefined),
    [activeSprint, pis]
  );
  const projectTeamMembers = useMemo(() => buildProjectTeamMembers(project, teams, users), [project, teams, users]);
  const projectKey = getIssueKeyPrefix(project) || 'PRJ';

  const issuesBySprint = useMemo(
    () =>
      buildSprintIssuesMap({
        tasks,
        users,
        project,
        projectId: project.id,
        projectKey,
        projectTeamMembers,
        projectSprints,
      }),
    [tasks, users, project, project.id, projectKey, projectTeamMembers, projectSprints]
  );

  const issues: IterationIssue[] = useMemo(
    () => (activeSprint ? issuesBySprint[activeSprint.id] || [] : []),
    [issuesBySprint, activeSprint]
  );

  const storeTaskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [activeFilter, setActiveFilter] = useState<FilterMode>('my');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ id: string; column: BoardColumn } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<{ column: BoardColumn; valid: boolean } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{ column: BoardColumn; index: number } | null>(null);
  const [doneZone, setDoneZone] = useState<DoneZone | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    itemId: string;
    from: BoardColumn;
    to: BoardColumn;
  } | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  // Assignee chosen in the transition dialog (undefined = keep current).
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | undefined>(undefined);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<Record<BoardColumn, string[]>>(() => ({
    TODO: issues.filter((i) => columnOfStatus(i.status) === 'TODO').map((i) => i.id),
    IN_PROGRESS: issues.filter((i) => columnOfStatus(i.status) === 'IN_PROGRESS').map((i) => i.id),
    DONE: issues.filter((i) => columnOfStatus(i.status) === 'DONE').map((i) => i.id),
  }));
  const [showAllMembers, setShowAllMembers] = useState(false);  const [hoverCardId, setHoverCardId] = useState<string | null>(null);

  // Workflow state lives in the store (shared with the Iteration Board) so status and
  // terminal resolution survive navigation and stay in sync across boards.
  const statusOf = (issue: IterationIssue): TaskStatus => {
    const storeTask = storeTaskById.get(issue.id);
    if (storeTask) return storeTask.status;
    return issueStatusOverrides[issue.id] ?? issue.status;
  };

  // Cancelled is a real terminal status (legacy DONE + resolution still maps here).
  const isCancelled = (issueId: string): boolean => {
    const storeTask = storeTaskById.get(issueId);
    if (storeTask) return isCancelledWorkItem(storeTask);
    const status = issueStatusOverrides[issueId];
    return status === 'CANCELLED' || issueResolutions[issueId] === 'CANCELLED';
  };

  // Meta for the override setters: who moved the issue and where it came from,
  // so a transition record is appended for board issues that are not store tasks.
  const issueById = (issueId: string): IterationIssue | undefined =>
    issues.find((i) => i.id === issueId);

  const overrideMeta = (issueId: string) => {
    const issue = issueById(issueId);
    const updated = issue ? new Date(issue.updatedDate).getTime() : NaN;
    return {
      previousStatus: issue ? statusOf(issue) : undefined,
      sourceEnteredAt: Number.isNaN(updated) ? undefined : new Date(updated).toISOString(),
      userId: currentUser?.id,
    };
  };

  const filteredIssues = useMemo(() => {
    let list = issues;
    if (selectedAssignee) {
      list = list.filter((i) => i.assigneeName === selectedAssignee);
    } else if (activeFilter === 'my') {
      const me = currentUser?.name || '';
      list = list.filter((i) => i.assigneeName === me);
    }
    if (activeFilter === 'recent') {
      list = [...list].sort((a, b) => (b.updatedDate || '').localeCompare(a.updatedDate || ''));
    }
    return list;
  }, [issues, activeFilter, selectedAssignee, currentUser]);

  const assignees = useMemo(() => {
    const seen = new Map<string, { name: string; initial: string; color: string; avatarUrl?: string }>();
    issues.forEach((i) => {
      if (i.assigneeName && i.assigneeName !== 'Unassigned' && !seen.has(i.assigneeName)) {
        seen.set(i.assigneeName, {
          name: i.assigneeName,
          initial: i.assigneeInitial,
          color: i.assigneeAvatarColor,
          avatarUrl: i.avatarUrl,
        });
      }
    });
    return Array.from(seen.values());
  }, [issues]);

  const columnItems = useMemo(() => {
    const visibleIds = new Set(filteredIssues.map((i) => i.id));
    const byId = new Map(filteredIssues.map((i) => [i.id, i]));
    const out: Record<BoardColumn, IterationIssue[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    const placed = new Set<string>();
    for (const col of BOARD_COLUMNS) {
      for (const id of columnOrder[col]) {
        if (placed.has(id) || !visibleIds.has(id)) continue;
        const it = byId.get(id);
        if (!it) continue;
        if (columnOfStatus(statusOf(it)) === col) {
          out[col].push(it);
          placed.add(id);
        }
      }
    }
    for (const it of filteredIssues) {
      if (placed.has(it.id)) continue;
      out[columnOfStatus(statusOf(it))].push(it);
      placed.add(it.id);
    }
    // DONE holds the terminal states: cancelled work is grouped first, delivered work
    // after — mirroring the reference board without touching the transition matrix.
    if (out.DONE.some((i) => isCancelled(i.id))) {
      out.DONE = [
        ...out.DONE.filter((i) => isCancelled(i.id)),
        ...out.DONE.filter((i) => !isCancelled(i.id)),
      ];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIssues, columnOrder, issueStatusOverrides, issueResolutions, storeTaskById]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showCommentModal) {
        resetPending();
      } else if (detailItemId) {
        setDetailItemId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCommentModal, detailItemId]);

  const resetPending = () => {
    setPendingTransition(null);
    setShowCommentModal(false);
    setCommentText('');
    setCommentImage(null);
    setPendingAssigneeId(undefined);
  };

  // Applies a confirmed transition. The status only changes here — never before the
  // comment modal (when one is required) has been confirmed with Continue.
  const applyTransition = (issueId: string, to: BoardColumn, text: string, image: string | null) => {
    const storeTask = storeTaskById.get(issueId);
    const newStatus = statusForColumn(to);
    const content = buildCommentContent(text, image);
    if (storeTask) {
      const updates: Partial<Task> = {
        status: newStatus,
        completedAt: to === 'DONE' ? new Date().toISOString() : undefined,
      };
      if (to === 'DONE') {
        updates.resolution = storeTask.resolution === 'CANCELLED' ? 'CANCELLED' : 'DONE';
        updates.resolvedAt = storeTask.resolvedAt || new Date().toISOString();
      } else {
        updates.resolution = undefined;
        updates.resolvedAt = undefined;
      }
      const res = updateTask(issueId, updates, currentUser?.id || 'u-pm-01');
      if (!res.ok) {
        toast.error(res.reason || 'That move is not allowed.');
        return;
      }
      if (content) {
        addComment(issueId, currentUser?.id || 'u-pm-01', content, image ? [makePasteAttachment(image)] : []);
      }
    } else {
      setIssueStatusOverride(issueId, newStatus, overrideMeta(issueId));
      if (content) {
        addIssueComment(issueId, currentUser?.id || 'u-pm-01', content, image ? [makePasteAttachment(image)] : []);
      }
    }
  };

  // Terminal state inside the DONE column: cancel / restore a finished work item.
  // Cancelled is a real status of its own - never DONE + resolution.
  const toggleCancelled = (issueId: string) => {
    const storeTask = storeTaskById.get(issueId);
    const cancelled = isCancelled(issueId);
    if (storeTask) {
      if (cancelled) {
        const res = updateTask(issueId, {
          status: 'DONE',
          resolution: 'DONE',
          resolvedAt: storeTask.resolvedAt || new Date().toISOString(),
          completedAt: storeTask.completedAt || new Date().toISOString(),
        }, currentUser?.id || 'u-pm-01');
        if (!res.ok) toast.error(res.reason || 'That move is not allowed.');
      } else {
        const res = updateTask(issueId, {
          status: 'CANCELLED',
          resolution: undefined,
          resolvedAt: undefined,
          completedAt: undefined,
        }, currentUser?.id || 'u-pm-01');
        if (!res.ok) toast.error(res.reason || 'That move is not allowed.');
      }
    } else if (cancelled) {
      setIssueStatusOverride(issueId, 'DONE', { ...overrideMeta(issueId), resolution: 'DONE' });
    } else {
      setIssueStatusOverride(issueId, 'CANCELLED', overrideMeta(issueId));
    }
  };

  const reorderInColumn = (id: string, col: BoardColumn, index: number) => {
    setColumnOrder((prev) => {
      const rest = prev[col].filter((x) => x !== id);
      const at = Math.max(0, Math.min(index, rest.length));
      const next = [...rest];
      next.splice(at, 0, id);
      return { ...prev, [col]: next };
    });
  };

  const handleDragStart = (issue: IterationIssue, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', issue.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id: issue.id, column: columnOfStatus(statusOf(issue)) });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverStatus(null);
    setDragOverIndex(null);
    setDoneZone(null);
    setHoverCardId(null);
  };

  const markDragOver = (col: BoardColumn, valid: boolean) => {
    setDragOverStatus((prev) =>
      prev && prev.column === col && prev.valid === valid ? prev : { column: col, valid }
    );
  };

  const handleColumnDragOver = (col: BoardColumn, e: React.DragEvent) => {
    if (!draggedItem) return;
    const valid = isValidDropTarget(draggedItem.column, col);
    // A stale zone highlight must not survive the pointer leaving the target.
    if (!(e.target as HTMLElement).closest('[data-done-zone]')) setDoneZone(null);
    markDragOver(col, valid);
    setDragOverIndex({ column: col, index: columnItems[col].length });
    if (valid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleCardDragOver = (
    issue: IterationIssue,
    col: BoardColumn,
    index: number,
    e: React.DragEvent
  ) => {
    e.stopPropagation();
    // Cards never sit inside a zone, so hovering one clears any zone highlight.
    setDoneZone(null);
    if (!draggedItem) return;
    const valid = isValidDropTarget(draggedItem.column, col);
    markDragOver(col, valid);
    setDragOverIndex({ column: col, index });
    setHoverCardId(issue.id);
    if (valid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOverStatus(null);
    setDragOverIndex(null);
    setDoneZone(null);
  };

  const handleDrop = (col: BoardColumn, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedItem?.id;
    const insertIndex = dragOverIndex && dragOverIndex.column === col ? dragOverIndex.index : columnItems[col].length;
    setDragOverStatus(null);
    setDragOverIndex(null);
    setDraggedItem(null);
    setDoneZone(null);
    if (!id) return;
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;
    const from = columnOfStatus(statusOf(issue));
    if (from === col) {
      reorderInColumn(id, col, insertIndex);
      return;
    }
    if (!canTransition(from, col)) return;
    if (needsComment(from, col)) {
      setPendingTransition({ itemId: id, from, to: col });
      setShowCommentModal(true);
    } else {
      applyTransition(id, col, '', null);
    }
  };

  // ---- Drag-only DONE drop targets (Cancelled / Done) ----
  const handleDoneZoneDragOver = (zone: DoneZone, e: React.DragEvent) => {
    if (!draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDoneZone(zone);
  };

  const handleDoneZoneDrop = (zone: DoneZone, e: React.DragEvent) => {
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain') || draggedItem?.id;
    const issue = id ? issues.find((i) => i.id === id) : undefined;
    const from = issue ? columnOfStatus(statusOf(issue)) : null;
    const clearDragState = () => {
      setDraggedItem(null);
      setDragOverStatus(null);
      setDragOverIndex(null);
      setDoneZone(null);
      setHoverCardId(null);
    };

    if (zone === 'DONE') {
      if (issue && from === 'DONE') {
        // Already terminal: "Done" restores a cancelled card (the existing
        // toggle the card's Ban button uses); an intact card needs no change.
        e.preventDefault();
        clearDragState();
        if (isCancelled(issue.id)) toggleCancelled(issue.id);
        return;
      }
      // Cross-column: existing transition logic verbatim (comment step,
      // applyTransition) — the same path a plain drop on DONE takes.
      setDoneZone(null);
      handleDrop('DONE', e);
      return;
    }

    // ---- Cancelled target ----
    e.preventDefault();
    clearDragState();
    if (!issue || from === null) return;
    if (from === 'DONE') {
      // Already terminal: cancel it (a no-op when it is already cancelled).
      if (!isCancelled(issue.id)) toggleCancelled(issue.id);
      return;
    }
    if (!canTransition(from, 'DONE')) return;
    // The terminal move, folded into one update: the issue lands on the real
    // CANCELLED status (never DONE + resolution), no comment step — mirroring
    // the card's Ban button.
    const storeTask = storeTaskById.get(issue.id);
    if (storeTask) {
      updateTask(issue.id, {
        status: 'CANCELLED',
        completedAt: undefined,
        resolution: undefined,
        resolvedAt: undefined,
      }, currentUser?.id || 'u-pm-01');
    } else {
      // One setter call records the whole terminal move into CANCELLED.
      setIssueStatusOverride(issue.id, 'CANCELLED', overrideMeta(issue.id));
    }
  };

  // Issue key -> the canonical Story/Issue Details page at /member/tasks/{key},
  // the same URL shape every other listing navigates with. The issue's own
  // displayed key is used verbatim so the URL matches what the user clicked;
  // resolution (and on-demand materialisation of a seed issue into a real
  // Task) happens on that page via resolveTaskByIssueKey.
  const openIssueDetailsPage = (issue: IterationIssue) => {
    navigate(`/member/tasks/${issue.key}`);
  };

  const pickFilter = (mode: FilterMode) => {
    setActiveFilter(mode);
    setSelectedAssignee(null);
  };

  const toggleMember = (name: string) => {
    if (selectedAssignee === name) {
      setSelectedAssignee(null);
      return;
    }
    setSelectedAssignee(name);
    setActiveFilter('all');
  };

  // Continue is always allowed: the comment (and a pasted screenshot) are optional.
  const handleCommentContinue = () => {
    if (!pendingTransition) return;
    const issue = issues.find((i) => i.id === pendingTransition.itemId);
    applyTransition(pendingTransition.itemId, pendingTransition.to, commentText, commentImage);
    // Jira-style dialog: an assignee picked with the transition is applied in
    // the same action. Store issues take the real field; seed issues write the
    // shared assignee override so every board/list agrees without materialising.
    if (issue && pendingAssigneeId !== undefined) {
      const storeTask = storeTaskById.get(issue.id);
      const currentId = storeTask
        ? storeTask.assigneeId
        : projectTeamMembers.find((u) => u.name === issue.assigneeName)?.id;
      if (pendingAssigneeId !== (currentId ?? '')) {
        if (storeTaskById.has(issue.id)) assignTask(issue.id, pendingAssigneeId, currentUser?.id || '');
        else setIssueAssigneeOverride(issue.id, pendingAssigneeId);
      }
    }
    resetPending();
  };

  const moveToFromDetail = (issueId: string, from: BoardColumn, to: BoardColumn) => {
    if (!canTransition(from, to)) return;
    if (needsComment(from, to)) {
      setDetailItemId(null);
      setPendingTransition({ itemId: issueId, from, to });
      setShowCommentModal(true);
      return;
    }
    applyTransition(issueId, to, '', null);
  };

  // Ctrl+V screenshot support: works whether focus sits inside the rich text editor
  // (which hands the image over via onImagePaste) or anywhere else in the modal.
  const captureImagePaste = useCallback((clipboardData: DataTransfer | null | undefined) => {
    const items = clipboardData?.items;
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setCommentImage(reader.result);
      };
      reader.readAsDataURL(file);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!showCommentModal) return;
    const onPaste = (e: ClipboardEvent) => {
      // The editor already claimed this paste and stored the screenshot.
      if (e.defaultPrevented) return;
      captureImagePaste(e.clipboardData);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [showCommentModal, captureImagePaste]);

  if (!activeSprint) {
    return (
      <div className="flex-1 min-w-0 pt-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f1f2f4] border border-[#dfe1e6] flex items-center justify-center mb-4">
            <LayoutDashboard className="w-6 h-6 text-[#747775]" />
          </div>
          <h2 className="text-base font-bold text-[#1f1f1f]">No live iteration</h2>
          <p className="text-sm text-[#6b778c] mt-1 max-w-[400px]">
            {project.name} does not have a live iteration right now. Open Iterations to view upcoming and
            completed iterations.
          </p>
          <button
            onClick={() => navigate(basePath)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white shadow-xs transition-colors cursor-pointer"
          >
            Go to Iterations
          </button>
        </div>
      </div>
    );
  }

  const endMs = new Date(activeSprint.endDate).getTime();
  const daysLeft = Number.isNaN(endMs) ? 0 : Math.max(0, Math.ceil((endMs - Date.now()) / 86400000));

  const detailIssue = detailItemId ? issues.find((i) => i.id === detailItemId) : undefined;
  const detailStoreTask = detailIssue ? storeTaskById.get(detailIssue.id) : undefined;
  const detailStatus = detailIssue ? statusOf(detailIssue) : 'TODO';
  const detailColumn = columnOfStatus(detailStatus);
  const detailCancelled = detailIssue ? isCancelled(detailIssue.id) : false;
  const detailComments: Comment[] = detailIssue
    ? [
        ...(detailStoreTask?.comments || []),
        ...(issueComments[detailIssue.id] || []),
      ].slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  const pendingIssue = pendingTransition ? issues.find((i) => i.id === pendingTransition.itemId) : undefined;
  // Assignee shown in the transition dialog: the store task's assignee when the
  // issue is real, else the seed row's current member.
  const pendingIssueStoreTask = pendingIssue ? storeTaskById.get(pendingIssue.id) : undefined;
  const pendingIssueAssigneeId = pendingIssueStoreTask
    ? pendingIssueStoreTask.assigneeId
    : pendingIssue
    ? projectTeamMembers.find((u) => u.name === pendingIssue.assigneeName)?.id
    : undefined;
  const visibleMembers = showAllMembers ? assignees : assignees.slice(0, 6);

  return (
    <div className="flex-1 min-w-0 pt-1 flex flex-col">
      <div className="flex-shrink-0 pb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {/* Line 1: small project name + PI context chip. */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[11px] font-semibold text-[#6b778c] truncate leading-tight">
              {project.name}
            </div>
            {activePiNumber !== undefined && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f0fdfa] border border-[#99f6e4] text-[10px] font-bold text-[#0f766e] flex-shrink-0">
                PI {activePiNumber}
              </span>
            )}
          </div>
          {/* Line 2: sprint title + date range share one line (badge and compact
              counts alongside); no separate description line. */}
          <div className="flex items-center gap-2 flex-wrap min-w-0 mt-0.5">
            <h2 className="text-base font-bold text-[#1f1f1f] truncate min-w-0">
              {activeSprint.name}
              <span className="ml-1.5 text-[13px] font-semibold text-[#42526e]">
                [{fmtRange(activeSprint.startDate, activeSprint.endDate)}]
              </span>
            </h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#00875a] text-white shadow-2xs">
              Active
            </span>
            <span className="text-xs font-semibold text-[#6b778c]">
              {issues.length} issue{issues.length === 1 ? '' : 's'}
            </span>
            <span className="text-[#d0d1d4]">|</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b778c]">
              <CalendarDays className="w-3.5 h-3.5" />
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate(`${basePath}/iteration-board`)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white shadow-xs transition-colors cursor-pointer flex-shrink-0"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Iteration Board
        </button>
      </div>

      <div className="flex-shrink-0 pb-3 flex items-center gap-2 flex-wrap">
        <div role="group" aria-label="Quick filters" className="inline-flex items-center gap-0.5 bg-white border border-[#dfe1e6] rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              data-filter={f.id}
              aria-pressed={activeFilter === f.id}
              onClick={() => pickFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                activeFilter === f.id
                  ? 'bg-[#deebff] text-[#0747a6]'
                  : 'text-[#42526e] hover:bg-[#f1f2f4]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleMembers.map((a) => (
            <button
              key={a.name}
              data-member={a.name}
              aria-pressed={selectedAssignee === a.name}
              title={a.name}
              onClick={() => toggleMember(a.name)}
              className={`inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${
                selectedAssignee === a.name
                  ? 'bg-[#deebff] border-[#4c9aff] text-[#0747a6]'
                  : 'bg-white border-[#dfe1e6] text-[#42526e] hover:border-[#4c9aff]'
              }`}
            >
              <span
                className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: a.color }}
              >
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  a.initial
                )}
              </span>
              {a.name.split(' ')[0]}
            </button>
          ))}
          {assignees.length > 6 && (
            <button
              onClick={() => setShowAllMembers((v) => !v)}
              className="text-[11px] font-bold text-[#0052cc] hover:text-[#0747a6] px-1.5 py-1 cursor-pointer"
            >
              {showAllMembers ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-[#6b778c]">
          {filteredIssues.length === 0 ? (
            <span data-empty-filter className="font-bold text-[#6b778c]">
              No work items match the current filter
            </span>
          ) : (
            <span data-visible-count className="font-semibold">
              {filteredIssues.length} of {issues.length} work items
            </span>
          )}
          <span className="text-[#d0d1d4]">|</span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Users className="w-3.5 h-3.5" />
            {assignees.length} member{assignees.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div data-board className="flex flex-col min-h-[calc(100vh_-_16rem)] overflow-x-auto pb-4">
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 min-w-[840px] items-stretch">
          {BOARD_COLUMNS.map((col) => {
            const items = columnItems[col];
            const over = dragOverStatus && dragOverStatus.column === col ? dragOverStatus : null;
            const isDone = col === 'DONE';
            // At rest the DONE column is a plain single column. While a card is
            // dragged validly over it, two compact drag-only drop targets (Cancelled
            // / Done) are revealed — they never render outside the drag interaction.
            const showDoneTargets = isDone && !!draggedItem && !!over && over.valid;
            // Cross-column drags switch DONE into an explicit "choose a destination"
            // state (targets only, per design). Same-column drags keep the cards so
            // reordering inside DONE still works.
            const hideDoneCards = showDoneTargets && !!draggedItem && draggedItem.column !== 'DONE';
            const bodyCls = isDone
              ? over && !over.valid
                ? 'bg-[#f7f8f9] border-[#dfe1e6] cursor-not-allowed'
                : 'bg-[#f7f8f9] border-[#dfe1e6]'
              : over
              ? over.valid
                ? 'bg-[#e3fcef] border-[#36b37e] border-dashed'
                : 'bg-[#f1f2f4] border-[#dfe1e6] border-dashed cursor-not-allowed'
              : 'bg-[#f7f8f9] border-[#dfe1e6]';

            const renderCard = (issue: IterationIssue, idx: number) => {
              const cancelled = isCancelled(issue.id);
              const isAnchor =
                !!draggedItem &&
                !!dragOverIndex &&
                dragOverIndex.column === col &&
                dragOverIndex.index === idx;
              return (
                <article
                  key={issue.id}
                  data-issue-key={issue.key}
                  data-assignee={issue.assigneeName}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`${issue.key}: ${issue.title}`}
                  onClick={() => openIssueDetailsPage(issue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openIssueDetailsPage(issue);
                    }
                  }}
                  onDragStart={(e) => handleDragStart(issue, e)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleCardDragOver(issue, col, idx, e)}
                  onMouseEnter={() => setHoverCardId(issue.id)}
                  onMouseLeave={() => setHoverCardId((v) => (v === issue.id ? null : v))}
                  className={`bg-white border rounded-md px-2.5 py-2 shadow-sm flex-shrink-0 cursor-grab active:cursor-grabbing select-none transition-colors ${
                    draggedItem && draggedItem.id === issue.id
                      ? 'opacity-40 border-[#4c9aff]'
                      : isAnchor
                      ? 'border-[#4c9aff] shadow-md'
                      : hoverCardId === issue.id
                      ? 'border-[#4c9aff]'
                      : 'border-[#dfe1e6] hover:border-[#4c9aff]'
                  }`}
                >
                  {/* The whole card opens the canonical issue-detail page
                      (/member/tasks/{issue.key}) - the same page every other
                      entry point uses. The key does the same thing (its click is
                      stopped so it is never mistaken for a drag start), while
                      the assignee avatar keeps the board's quick-view dialog
                      reachable without leaving the sprint. */}
                  <div className="flex items-center justify-between gap-1.5 mb-1 min-w-0">
                    <span
                      onClick={(e) => { e.stopPropagation(); openIssueDetailsPage(issue); }}
                      className="text-[11px] font-bold text-[#0052cc] truncate min-w-0 cursor-pointer"
                    >
                      {issue.key}
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {cancelled && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#f1f2f4] text-[#6b778c] border border-[#dfe1e6]">
                          Cancelled
                        </span>
                      )}
                      <span
                        title={`${issue.assigneeName} — quick view`}
                        onClick={(e) => { e.stopPropagation(); setDetailItemId(issue.id); }}
                        className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white cursor-pointer"
                        style={{ backgroundColor: issue.assigneeAvatarColor }}
                      >
                        {issue.avatarUrl ? (
                          <img
                            src={issue.avatarUrl}
                            alt={issue.assigneeName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          issue.assigneeInitial
                        )}
                      </span>
                    </span>
                  </div>
                  <div
                    className="text-xs font-semibold text-[#1f1f1f] leading-snug line-clamp-2 mb-1"
                    title={issue.title}
                  >
                    {issue.title}
                  </div>
                  {/* Epic / category as a compact colored label under the title. */}
                  <div className="mb-1 min-w-0">
                    <span
                      className={`inline-block max-w-full truncate text-[9px] font-bold px-1.5 py-0.5 rounded border ${issue.epicColor}`}
                      title={issue.epicName}
                    >
                      {issue.epicName}
                    </span>
                  </div>
                  {/* Bottom row: existing metadata only, compacted into one row —
                      priority dot, type badge, and story points. No separate
                      large row for the issue type. */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityDotColor(issue.priority)}`}
                      title={`Priority: ${issue.priority.charAt(0) + issue.priority.slice(1).toLowerCase()}`}
                    />
                    {TYPE_BADGE[issue.type] && (
                      <span
                        className={`text-[9px] font-bold px-1 rounded flex-shrink-0 ${TYPE_BADGE[issue.type].className}`}
                        title={typeLabel(issue.type)}
                      >
                        {TYPE_BADGE[issue.type].label}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-[#42526e] bg-[#f1f2f4] rounded px-1 py-0.5 flex-shrink-0">
                      {issue.storyPoints ?? 0}
                    </span>
                  </div>
                </article>
              );
            };

            return (
              <section key={col} className="min-w-0 flex flex-col">
                <div
                  data-column={col}
                  aria-label={`${columnLabel[col]} column`}
                  onDragOver={(e) => handleColumnDragOver(col, e)}
                  onDrop={(e) => handleDrop(col, e)}
                  onDragLeave={handleColumnDragLeave}
                  className={`flex-1 min-h-0 flex flex-col rounded-xl border-2 overflow-hidden transition-colors ${bodyCls}`}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[#e4e6eb] flex-shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLUMN_DOTS[col]}`} />
                      <span className="text-[11px] font-black tracking-wider text-[#42526e]">
                        {columnLabel[col]}
                      </span>
                    </div>
                    <span
                      data-column-count={items.length}
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#f1f2f4] text-[#42526e]"
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 pt-2 min-h-[18px] flex-shrink-0">
                    {over && (!isDone || !over.valid) && (
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          over.valid ? 'bg-[#36b37e] text-white' : 'bg-[#6b778c] text-white'
                        }`}
                      >
                        {over.valid ? 'Drop here' : 'Not allowed'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-2 px-2.5 py-2">
                    {/* Drag-only drop targets: visible exclusively while a card is
                        dragged validly over DONE, gone the moment the drag ends. */}
                    {showDoneTargets && (
                      <div className="flex-1 min-h-0 flex flex-col gap-2">
                        {(['CANCELLED', 'DONE'] as const).map((zone) => (
                          <div
                            key={zone}
                            data-done-zone={zone}
                            onDragOver={(e) => handleDoneZoneDragOver(zone, e)}
                            onDrop={(e) => handleDoneZoneDrop(zone, e)}
                            className={`flex-1 min-h-[72px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
                              doneZone === zone
                                ? zone === 'CANCELLED'
                                  ? 'border-[#6b778c] bg-[#f1f2f4]'
                                  : 'border-[#36b37e] bg-[#e3fcef]'
                                : zone === 'CANCELLED'
                                ? 'border-[#dfe1e6] bg-[#f7f8f9]'
                                : 'border-[#abf5d1] bg-[#e3fcef]/50'
                            }`}
                          >
                            <div
                              className={`text-[10px] font-black uppercase tracking-wider ${
                                zone === 'CANCELLED' ? 'text-[#6b778c]' : 'text-[#00875a]'
                              }`}
                            >
                              {zone === 'CANCELLED' ? 'Cancelled' : 'Done'}
                            </div>
                            <div className="text-[9px] font-black uppercase tracking-wider text-[#8590a2] mt-0.5">
                              Drop here
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hideDoneCards &&
                      (items.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center px-4 py-8">
                          <p className="text-[11px] text-[#8590a2]">No work items</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {items.map((issue, i) => renderCard(issue, i))}
                        </div>
                      ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {showCommentModal && pendingTransition && pendingIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#091e42]/45"
          data-comment-modal
          onClick={resetPending}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Transition dialog"
            className="w-full max-w-lg bg-white rounded-xl border border-[#dfe1e6] shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">New status</div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-[#f1f2f4] text-[#42526e]">
                    {columnLabel[pendingTransition.from]}
                  </span>
                  <span className="text-[#6b778c]">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#deebff] text-[#0052cc]">
                    {columnLabel[pendingTransition.to]}
                  </span>
                </div>
              </div>
              <button
                aria-label="Close"
                onClick={resetPending}
                className="p-1 rounded-md text-[#6b778c] hover:bg-[#f1f2f4] hover:text-[#1f1f1f] cursor-pointer flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-bold text-[#0052cc]">{pendingIssue.key}</span>
                <span className="text-xs text-[#6b778c] truncate" title={pendingIssue.title}>
                  {pendingIssue.title}
                </span>
              </div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1">
                Assignee
              </label>
              <select
                value={pendingAssigneeId ?? pendingIssueAssigneeId ?? ''}
                onChange={(e) => setPendingAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-[#dfe1e6] bg-white px-2.5 py-2 text-xs font-semibold text-[#1f1f1f] focus:border-[#4c9aff] focus:outline-none focus:ring-2 focus:ring-[#4c9aff]/20 mb-2"
              >
                <option value="">Unassigned</option>
                {projectTeamMembers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div
                className="rounded-lg border border-[#dfe1e6] focus-within:border-[#4c9aff] focus-within:ring-2 focus-within:ring-[#4c9aff]/20 transition-colors overflow-hidden"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) return;
                  const editable = e.currentTarget.querySelector('.ProseMirror') as HTMLElement | null;
                  if (editable && document.activeElement !== editable) editable.focus();
                }}
              >
                <RichTextEditor
                  content={commentText}
                  onChange={setCommentText}
                  placeholder="Add a comment for this transition (optional)..."
                  minHeight="96px"
                  autoFocus
                  mentionableUsers={projectTeamMembers}
                  editableAttributes={{ 'data-comment-input': '' }}
                  onImagePaste={(dataUrl) => setCommentImage(dataUrl)}
                />
              </div>
              <p className="mt-1 text-[10px] text-[#747775]">
                Paste a screenshot with Ctrl+V — the comment itself is optional.
              </p>
            </div>
            {commentImage && (
              <div
                data-paste-preview
                className="mb-3 flex items-start gap-2 p-2 rounded-lg bg-[#f7f8f9] border border-[#e4e6eb]"
              >
                <img
                  src={commentImage}
                  alt="Pasted screenshot"
                  className="w-24 h-16 object-cover rounded border border-[#dfe1e6]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#42526e]">Screenshot attached</p>
                  <button
                    data-paste-remove
                    onClick={() => setCommentImage(null)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#bf2600] hover:text-[#991d00] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                data-action="comment-cancel"
                onClick={resetPending}
                className="px-3 py-1.5 rounded-md text-xs font-bold text-[#42526e] hover:bg-[#f1f2f4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                data-action="comment-continue"
                onClick={handleCommentContinue}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {detailIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#091e42]/45"
          data-detail-modal
          onClick={() => setDetailItemId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Issue ${detailIssue.key}`}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-xl border border-[#dfe1e6] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#e4e6eb]">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span data-detail-key className="text-xs font-bold text-[#0052cc]">
                  {detailIssue.key}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${detailCancelled ? 'bg-[#f1f2f4] text-[#6b778c]' : issueStatusClass(detailStatus)}`}>
                  {detailCancelled ? 'Cancelled' : issueStatusLabel(detailStatus)}
                </span>
              </div>
              <button
                aria-label="Close"
                onClick={() => setDetailItemId(null)}
                className="p-1 rounded-md text-[#6b778c] hover:bg-[#f1f2f4] hover:text-[#1f1f1f] cursor-pointer flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <h3 className="text-base font-bold text-[#1f1f1f] mb-3">{detailIssue.title}</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Type</div>
                  <div className="text-xs font-bold text-[#1f1f1f] truncate">
                    {typeLabel(detailStoreTask?.type ?? detailIssue.type)}
                  </div>
                </div>
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Priority</div>
                  <div className="text-xs font-bold text-[#1f1f1f] truncate">{detailIssue.priority}</div>
                </div>
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Points</div>
                  <div className="text-xs font-bold text-[#1f1f1f]">{detailIssue.storyPoints ?? 0}</div>
                </div>
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Epic</div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: detailIssue.epicColor }}
                    />
                    <span className="text-xs font-bold text-[#1f1f1f] truncate">{detailIssue.epicName}</span>
                  </div>
                </div>
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">PI</div>
                  <div className="text-xs font-bold text-[#1f1f1f] truncate">
                    {detailIssue.releaseTag ? detailIssue.releaseTag.split(' ').pop() : '—'}
                  </div>
                </div>
                <div className="bg-[#f7f8f9] border border-[#e4e6eb] rounded-lg px-2.5 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Updated</div>
                  <div className="text-xs font-bold text-[#1f1f1f] truncate">{fmtDate(detailIssue.updatedDate)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-[#f7f8f9] border border-[#e4e6eb]">
                <span
                  className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: detailIssue.assigneeAvatarColor }}
                >
                  {detailIssue.avatarUrl ? (
                    <img
                      src={detailIssue.avatarUrl}
                      alt={detailIssue.assigneeName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    detailIssue.assigneeInitial
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Assignee</div>
                  <div className="text-xs font-bold text-[#1f1f1f] truncate">{detailIssue.assigneeName}</div>
                </div>
              </div>

              {detailStoreTask?.description && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1">
                    Description
                  </div>
                  <p className="text-xs text-[#42526e] leading-relaxed">{detailStoreTask.description}</p>
                </div>
              )}

              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1.5">
                  Move work item
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {BOARD_COLUMNS.filter((c) => canTransition(detailColumn, c)).map((c) => (
                    <button
                      key={c}
                      data-move-to={c}
                      onClick={() => moveToFromDetail(detailIssue.id, detailColumn, c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-white border border-[#dfe1e6] text-[#42526e] hover:border-[#4c9aff] hover:text-[#0747a6] cursor-pointer"
                    >
                      {needsComment(detailColumn, c) && <MessageSquare className="w-3 h-3" />}
                      Move to {c === 'DONE' ? 'Done' : c === 'TODO' ? 'To Do' : 'In Progress'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-[#747775]">
                  Current column: {detailCancelled ? 'Cancelled' : columnLabel[detailColumn]} · invalid moves stay unavailable.
                </p>
              </div>

              {detailColumn === 'DONE' && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1.5">
                    Completion state
                  </div>
                  <button
                    data-action={detailCancelled ? 'restore-done' : 'mark-cancelled'}
                    onClick={() => toggleCancelled(detailIssue.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-white border cursor-pointer ${
                      detailCancelled
                        ? 'border-[#dfe1e6] text-[#42526e] hover:border-[#36b37e] hover:text-[#00875a]'
                        : 'border-[#ffab91] text-[#bf2600] hover:bg-[#ffeceb]'
                    }`}
                  >
                    {detailCancelled ? <RotateCcw className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    {detailCancelled ? 'Restore to Done' : 'Mark as Cancelled'}
                  </button>
                  <p className="mt-1.5 text-[10px] text-[#747775]">
                    Cancelled work stays in the Done column and can be restored.
                  </p>
                </div>
              )}

              <div data-comment-count={detailComments.length}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1.5">
                  Comments ({detailComments.length})
                </div>
                {detailComments.length === 0 ? (
                  <p className="text-xs text-[#8590a2]">No comments yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detailComments.map((c) => {
                      const author = users.find((u) => u.id === c.userId);
                      return (
                        <div
                          key={c.id}
                          data-comment-item
                          className="flex items-start gap-2 p-2 rounded-lg bg-[#f7f8f9] border border-[#e4e6eb]"
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: author?.avatarColor || '#6b778c' }}
                          >
                            {(author?.name || 'U')[0]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1f1f1f] truncate">
                                {author?.name || 'Unknown user'}
                              </span>
                              <span className="text-[10px] text-[#747775] flex-shrink-0">
                                {fmtDateTime(c.createdAt)}
                              </span>
                            </div>
                            <div
                              className="text-xs text-[#42526e] mt-0.5 break-words [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-[#dfe1e6]"
                              dangerouslySetInnerHTML={{ __html: c.content }}
                            />
                            {(c.attachments || []).map((att) => (
                              <div
                                key={att.fileId}
                                className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#42526e] bg-white border border-[#dfe1e6] rounded px-1.5 py-0.5"
                              >
                                {att.fileName}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
