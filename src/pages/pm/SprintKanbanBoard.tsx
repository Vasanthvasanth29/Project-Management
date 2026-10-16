import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Check, GripVertical, Paperclip, MessageSquare,
  AlertCircle, CheckCircle2, XCircle, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { RichTextEditor } from '../../components/common/RichTextEditor';
import { issuePath } from '../../utils/issueUrl';
import { buildProjectTeamMembers, getEpicColor, type SprintBoardTask } from '../../utils/sprintIssues';
import {
  BOARD_COLUMNS, statusToColumn, columnToStatus, canTransition, needsComment,
  type BoardColumn,
} from '../../utils/sprintTransitions';
import { resolveIssueKey } from '../../utils/issueKeyResolver';
import { getStatusColor, getStatusLabel, isCancelledWorkItem } from '../../utils/roleUtils';
import type { Task, Sprint, CommentAttachment, Comment } from '../../types';

interface SprintKanbanBoardProps {
  projectId: string;
  sprint: Sprint;
  /** Store tasks plus the sprint's seed issues (transient cards from SprintManager). */
  sprintTasks: Task[];
}

interface PendingTransition {
  taskId: string;
  from: BoardColumn;
  to: BoardColumn;
}

// The two drag-only drop targets revealed inside the DONE column.
type DoneZone = 'CANCELLED' | 'DONE';

interface PastedImage {
  dataUrl: string;
  name: string;
  size: number;
  type: string;
}

type FilterMode = 'mine' | 'all' | 'member';

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  EPIC: { label: 'EP', className: 'bg-purple-100 text-purple-800' },
  FEATURE: { label: 'FT', className: 'bg-indigo-100 text-indigo-800' },
  STORY: { label: 'ST', className: 'bg-emerald-100 text-emerald-800' },
  TASK: { label: 'TA', className: 'bg-blue-100 text-blue-800' },
  'SUB-TASK': { label: 'SB', className: 'bg-sky-100 text-sky-800' },
  BUG_FIX: { label: 'BG', className: 'bg-red-100 text-red-800' },
  IMPROVEMENT: { label: 'IM', className: 'bg-amber-100 text-amber-800' },
  INITIATIVE: { label: 'IN', className: 'bg-fuchsia-100 text-fuchsia-800' },
};

const COLUMN_DOTS: Record<BoardColumn, string> = {
  TODO: 'bg-[#6b778c]',
  IN_PROGRESS: 'bg-[#0052cc]',
  DONE: 'bg-[#00875a]',
};

export const SprintKanbanBoard: React.FC<SprintKanbanBoardProps> = ({ projectId, sprint, sprintTasks }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const {
    tasks, users, teams, project: _unused, projects,
    issueStatusOverrides, issueResolutions, issueComments,
    setIssueStatusOverride, setIssueResolutionOverride, addIssueComment,
    updateTask, updateTaskStatus, reorderTasks, addComment, addFileRecord, assignTask,
    setIssueAssigneeOverride,
  } = useAppStore() as any;

  const project = projects.find((p: any) => p.id === projectId);
  const projectTeamMembers = useMemo(
    () => buildProjectTeamMembers(project, teams, users),
    [project, teams, users]
  );

  // Store task first, then the transient seed cards — one lookup for every board path.
  const findTask = (taskId: string): Task | undefined =>
    (tasks as Task[]).find((t) => t.id === taskId) ?? sprintTasks.find((t) => t.id === taskId);
  const isStoreTask = (taskId: string): boolean =>
    (tasks as Task[]).some((t) => t.id === taskId);

  // ---- Filters (default: only the current user's own work) ----
  // ADMIN defaults to the full iteration scope; every other role defaults to their own work.
  const [filterMode, setFilterMode] = useState<FilterMode>(() =>
    currentUser?.role === 'ADMIN' ? 'all' : 'mine'
  );
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [showFewer, setShowFewer] = useState(true);

  const visibleTasks = useMemo(() => {
    if (filterMode === 'mine') {
      return sprintTasks.filter((t) => t.assigneeId === currentUser?.id);
    }
    if (filterMode === 'member' && filterMemberId) {
      return sprintTasks.filter((t) => t.assigneeId === filterMemberId);
    }
    return sprintTasks;
  }, [sprintTasks, filterMode, filterMemberId, currentUser]);

  const columnTasks = (column: BoardColumn): Task[] =>
    visibleTasks.filter((t) => statusToColumn(t.status) === column);

  // ---- Epic resolution (walk the real parentId chain, never fabricated) ----
  const resolveEpicTitle = (task: Task): string | null => {
    let cursor: Task | undefined = task;
    let hops = 0;
    while (cursor?.parentId && hops < 6) {
      const parent = tasks.find((t: Task) => t.id === cursor!.parentId);
      if (!parent) return null;
      if (parent.type === 'EPIC') return parent.title;
      cursor = parent;
      hops += 1;
    }
    // Seed cards carry their epic directly instead of a parent chain.
    return (task as SprintBoardTask).epicName || null;
  };

  // ---- Drag state ----
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BoardColumn | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [doneZone, setDoneZone] = useState<DoneZone | null>(null);

  // ---- Pending transition / modal state ----
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [pastedImage, setPastedImage] = useState<PastedImage | null>(null);
  // Assignee chosen in the transition dialog (undefined = keep current).
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | undefined>(undefined);

  const draggingTask = draggingTaskId ? findTask(draggingTaskId) : undefined;
  const draggingFromColumn = draggingTask ? statusToColumn(draggingTask.status) : null;

  // The dragover validity check must never depend on React state: native drag events
  // can fire dragover before a state update from dragstart has re-rendered and rebound
  // these closures, which would otherwise let an invalid drop slip through on the very
  // first event of a fast drag. A ref is updated synchronously, so it is always current.
  const draggingFromColumnRef = useRef<BoardColumn | null>(null);

  const resetDragState = () => {
    draggingFromColumnRef.current = null;
    setDraggingTaskId(null);
    setDragOverColumn(null);
    setDragOverTaskId(null);
    setDoneZone(null);
  };

  const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    const task = findTask(taskId);
    draggingFromColumnRef.current = task ? statusToColumn(task.status) : null;
    setDraggingTaskId(taskId);
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>, column: BoardColumn) => {
    const fromCol = draggingFromColumnRef.current;
    const valid = fromCol ? canTransition(fromCol, column) : false;
    if (!valid) return; // no preventDefault => browser shows a blocked cursor, drop never fires here
    // A stale zone highlight must not survive the pointer leaving the target.
    if (!(e.target as HTMLElement).closest('[data-done-zone]')) setDoneZone(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== column) setDragOverColumn(column);
  };

  const handleColumnDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverColumn(null);
    setDragOverTaskId(null);
    setDoneZone(null);
  };

  const beginTransition = (taskId: string, from: BoardColumn, to: BoardColumn) => {
    if (from === to) return;
    if (!canTransition(from, to)) {
      toast.error('That move is not allowed. Work items must progress through In Progress.');
      return;
    }
    const transition: PendingTransition = { taskId, from, to };
    if (needsComment(from, to)) {
      setPendingTransition(transition);
      setCommentText('');
      setPastedImage(null);
      // Pre-select the current assignee so the dialog's Assignee field is controlled.
      setPendingAssigneeId(findTask(taskId)?.assigneeId ?? '');
      setShowCommentModal(true);
    } else {
      // Only DONE -> IN PROGRESS takes this path (no confirmation required).
      applyTransition(transition);
    }
  };

  // Applies the transition immediately: the comment (and screenshot) are optional, so
  // Continue always completes the move — the board never adds a second confirmation.
  // `resolution === 'CANCELLED'` is the terminal cancel path: the card lands on the
  // real CANCELLED status (never DONE + resolution).
  const applyTransition = (transition: PendingTransition, resolution?: 'DONE' | 'CANCELLED') => {
    const { taskId, to } = transition;
    const task = findTask(taskId);
    if (!task) return;
    const cancelling = resolution === 'CANCELLED';
    const newStatus = cancelling ? 'CANCELLED' as const : columnToStatus(to);
    if (isStoreTask(taskId)) {
      // Resolution rides along with the status change so exactly one transition
      // record is written (a cancelled card never records an intermediate DONE).
      const res = updateTaskStatus(taskId, newStatus, currentUser?.id || '', !cancelling && to === 'DONE' ? resolution || 'DONE' : undefined);
      if (!res.ok) {
        toast.error(res.reason || 'That move is not allowed.');
        return;
      }
      if (cancelling) {
        updateTask(taskId, { resolution: undefined, resolvedAt: undefined, completedAt: undefined });
      } else if (to === 'DONE') {
        updateTask(taskId, { resolution: resolution || 'DONE', resolvedAt: new Date().toISOString() });
      } else if (task.resolution) {
        updateTask(taskId, { resolution: undefined, resolvedAt: undefined });
      }
    } else {
      // Seed issue: status / terminal resolution live in the shared store maps so the
      // Live Iteration page reflects this move too. One call carries the whole change
      // (status + resolution + who/when) so a single transition record is appended.
      setIssueStatusOverride(taskId, newStatus, {
        previousStatus: task.status,
        sourceEnteredAt: task.createdAt,
        userId: currentUser?.id || undefined,
        resolution: !cancelling && to === 'DONE' ? resolution || 'DONE' : undefined,
      });
    }
    toast.success(`"${task.title}" moved to ${cancelling ? 'Cancelled' : BOARD_COLUMNS.find((c) => c.key === to)?.label}`);
  };

  const handleColumnDrop = (e: React.DragEvent<HTMLDivElement>, column: BoardColumn) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    resetDragState();
    if (!taskId) return;
    const task = findTask(taskId);
    if (!task) return;

    // A card dragged in from the Project Work Queue (not yet part of this sprint):
    // assigning it is a planning action, not a workflow transition.
    if (task.sprintId !== sprint.id) {
      const res = updateTask(taskId, { sprintId: sprint.id, status: columnToStatus(column) }, currentUser?.id || '');
      if (res.ok) {
        toast.success(`"${task.title}" added to ${sprint.name} (${BOARD_COLUMNS.find((c) => c.key === column)?.label})`);
      } else {
        toast.error(`"${task.title}" added to ${sprint.name}, but its status is managed by the Initiative workflow.`);
      }
      return;
    }

    const fromCol = statusToColumn(task.status);
    if (fromCol === column) return; // handled by card-level reorder drop
    beginTransition(taskId, fromCol, column);
  };

  // Same-column reorder: dropping directly on another card inserts before it.
  const handleCardDrop = (e: React.DragEvent<HTMLDivElement>, targetTask: Task, column: BoardColumn) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/plain');
    resetDragState();
    if (!taskId || taskId === targetTask.id) return;
    const task = findTask(taskId);
    if (!task) return;

    if (task.sprintId !== sprint.id) {
      const res = updateTask(taskId, { sprintId: sprint.id, status: columnToStatus(column) }, currentUser?.id || '');
      if (res.ok) {
        toast.success(`"${task.title}" added to ${sprint.name}`);
      } else {
        toast.error(res.reason || 'That status change is not allowed.');
      }
      return;
    }

    const fromCol = statusToColumn(task.status);
    if (fromCol === column) {
      // Seed cards have no store order to persist; only real tasks are reordered.
      if (isStoreTask(taskId) && isStoreTask(targetTask.id)) {
        reorderTasks(taskId, targetTask.id, 'before');
      }
      return;
    }
    beginTransition(taskId, fromCol, column);
  };

  // ---- Drag-only DONE drop targets (Cancelled / Done) ----
  const handleDoneZoneDragOver = (zone: DoneZone, e: React.DragEvent<HTMLDivElement>) => {
    const fromCol = draggingFromColumnRef.current;
    if (!fromCol || !canTransition(fromCol, 'DONE')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDoneZone(zone);
  };

  const handleDoneZoneDrop = (zone: DoneZone, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/plain');
    resetDragState(); // hides the targets immediately after the drop
    if (!taskId) return;
    const task = findTask(taskId);
    if (!task) return;

    const fromCol = statusToColumn(task.status);
    if (task.sprintId !== sprint.id) {
      // Work Queue card pulled straight into a terminal state.
      const res = updateTask(taskId, zone === 'CANCELLED'
        ? { sprintId: sprint.id, status: 'CANCELLED', resolution: undefined, resolvedAt: undefined, completedAt: undefined }
        : { sprintId: sprint.id, status: columnToStatus('DONE') }, currentUser?.id || '');
      if (res.ok) {
        toast.success(`"${task.title}" added to ${sprint.name} (${zone === 'CANCELLED' ? 'Cancelled' : 'Done'})`);
      } else {
        toast.error(res.reason || 'That status change is not allowed.');
      }
      return;
    }

    if (zone === 'DONE') {
      if (fromCol === 'DONE') {
        // Already terminal: restore a cancelled card back to Done.
        if (task.status === 'CANCELLED' || task.resolution === 'CANCELLED') {
          applyTransition({ taskId, from: 'DONE', to: 'DONE' }, 'DONE');
        }
        return;
      }
      // Existing transition logic verbatim: matrix check, comment step, apply.
      beginTransition(taskId, fromCol, 'DONE');
      return;
    }
    if (fromCol !== 'DONE' && !canTransition(fromCol, 'DONE')) return;
    // Terminal cancel — the real CANCELLED status, with no comment step (like the Ban chip).
    applyTransition({ taskId, from: fromCol, to: 'DONE' }, 'CANCELLED');
  };

  // ---- Comment modal (optional rich text + Ctrl+V screenshot paste) ----
  const imageFromDataUrl = (dataUrl: string): PastedImage => {
    const semicolon = dataUrl.indexOf(';');
    const type = semicolon > 5 ? dataUrl.slice(5, semicolon) : 'image/png';
    return {
      dataUrl,
      name: 'pasted-screenshot.png',
      size: Math.round((dataUrl.length * 3) / 4),
      type,
    };
  };

  const captureImagePaste = (clipboardData: DataTransfer | null | undefined): boolean => {
    const items = clipboardData?.items;
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPastedImage({ dataUrl: reader.result, name: file.name || 'pasted-screenshot.png', size: file.size, type: file.type });
          toast.info('Screenshot attached to comment');
        }
      };
      try {
        reader.readAsDataURL(file);
      } catch {
        // Clipboard image access unavailable in this browser — fail gracefully.
      }
      return true;
    }
    return false;
  };

  // A screenshot pasted outside the editor (or when it did not claim the event) still
  // has to reach the modal, so the paste is captured at document level too.
  useEffect(() => {
    if (!showCommentModal) return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      captureImagePaste(e.clipboardData);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCommentModal]);

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setPendingTransition(null);
    setCommentText('');
    setPastedImage(null);
    setPendingAssigneeId(undefined);
  };

  // The rich text editor serialises an empty document to "<p></p>".
  const isBlankHtml = (html: string): boolean => {
    const withoutImages = html.replace(/<img\b[^>]*>/gi, '');
    return withoutImages.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length === 0;
  };

  const confirmCommentModal = () => {
    if (!pendingTransition) return;
    const { taskId } = pendingTransition;
    const body = commentText && !isBlankHtml(commentText) ? commentText.trim() : '';
    const imagePart = pastedImage ? `<img src="${pastedImage.dataUrl}" alt="Pasted screenshot" />` : '';    if (body || imagePart) {
      const content = body && imagePart ? `${body}<br/>${imagePart}` : body || imagePart;
      if (isStoreTask(taskId)) {
        const attachments: CommentAttachment[] = [];
        if (pastedImage) {
          const record = addFileRecord({
            organizationId: 'org-001',
            projectId,
            taskId,
            uploadedById: currentUser?.id || '',
            fileName: pastedImage.name,
            originalFileName: pastedImage.name,
            fileUrl: pastedImage.dataUrl,
            fileSize: pastedImage.size,
            mimeType: pastedImage.type,
            checksum: 'local-paste',
            version: 1,
            versionGroupId: `fr-${taskId}-${Date.now()}`,
            isLatestVersion: true,
            isDeleted: false,
          });
          attachments.push({
            fileId: record.id,
            fileName: record.fileName,
            fileSize: record.fileSize,
            fileType: record.mimeType,
            attachedAt: new Date().toISOString(),
          });
        }
        addComment(taskId, currentUser?.id || '', content, attachments);
      } else {
        addIssueComment(taskId, currentUser?.id || '', content);
      }
    }

    // Assignee chosen in the dialog: real field for store tasks, shared override
    // for seed cards, so every board and list agrees on the owner.
    if (pendingAssigneeId !== undefined) {
      const currentId = findTask(taskId)?.assigneeId ?? '';
      if (currentId !== pendingAssigneeId) {
        if (isStoreTask(taskId)) assignTask(taskId, pendingAssigneeId, currentUser?.id || '');
        else setIssueAssigneeOverride(taskId, pendingAssigneeId);
      }
    }

    setShowCommentModal(false);
    setCommentText('');
    setPastedImage(null);
    setPendingAssigneeId(undefined);
    // Continue is always allowed: it completes the transition immediately.
    applyTransition(pendingTransition);
    setPendingTransition(null);
  };

  // ---- Quick add ----
  const [quickAddColumn, setQuickAddColumn] = useState<BoardColumn | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const { createTask } = useAppStore();

  const handleQuickAdd = (column: BoardColumn) => {
    if (!quickAddTitle.trim()) return;
    createTask({
      projectId,
      sprintId: sprint.id,
      title: quickAddTitle.trim(),
      description: '',
      type: 'TASK',
      status: columnToStatus(column),
      priority: 'MEDIUM',
      createdById: currentUser?.id || '',
    });
    setQuickAddTitle('');
    setQuickAddColumn(null);
    toast.success('Work item added to iteration');
  };

  // Seed cards have no task detail page yet, so only real work items navigate.
  const openTask = (taskId: string) => {
    if (!isStoreTask(taskId)) return;
    navigate(issuePath(taskId));
  };

  const displayedMembers = showFewer ? projectTeamMembers.slice(0, 8) : projectTeamMembers;

  return (
    <div className="p-4 bg-[#f8fafd] flex flex-col min-h-[calc(100vh_-_26rem)]">
      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => { setFilterMode('mine'); setFilterMemberId(null); }}
          className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-all ${
            filterMode === 'mine' ? 'bg-[#1a73e8] text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Only My Work Items
        </button>
        <button
          type="button"
          onClick={() => { setFilterMode('all'); setFilterMemberId(null); }}
          className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-all ${
            filterMode === 'all' ? 'bg-[#1a73e8] text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Iteration Work Items
        </button>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        {displayedMembers.map((m: any) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setFilterMode('member'); setFilterMemberId(m.id); }}
            className={`text-[11px] px-2 py-1 rounded-full font-medium transition-all ${
              filterMode === 'member' && filterMemberId === m.id
                ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {m.name.split(' ')[0]}
          </button>
        ))}
        {projectTeamMembers.length > 8 && (
          <button
            type="button"
            onClick={() => setShowFewer(!showFewer)}
            className="text-[11px] px-1.5 py-1 text-[#0052cc] hover:underline font-semibold"
          >
              {showFewer ? '...Show more' : '...Show less'}
          </button>
        )}
      </div>

      {/* 3-column board */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {BOARD_COLUMNS.map((col) => {
          const colTasks = columnTasks(col.key);
          const isOver = dragOverColumn === col.key;
          const isBlocked = draggingFromColumn !== null && draggingFromColumn !== col.key && !canTransition(draggingFromColumn, col.key);
          const cancelledOf = (t: Task) => isCancelledWorkItem(t);
          // At rest DONE is a plain single column — no permanent section headers.
          // Cancelled cards simply keep their existing leading position.
          const orderedTasks =
            col.key === 'DONE'
              ? [...colTasks.filter(cancelledOf), ...colTasks.filter((t) => !cancelledOf(t))]
              : colTasks;
          // Two compact drag-only drop targets appear inside DONE while a card is
          // dragged over it; they never render outside the drag interaction.
          const showDoneTargets = col.key === 'DONE' && isOver;
          // Cross-column drags switch DONE into an explicit "choose a destination"
          // state (targets only). Same-column drags keep the cards so reordering
          // inside DONE still works.
          const hideDoneCards = showDoneTargets && draggingFromColumn !== 'DONE';

          return (
            <div
              key={col.key}
              data-column={col.key}
              onDragOver={(e) => handleColumnDragOver(e, col.key)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(e, col.key)}
              className={`rounded-2xl p-3 border transition-all duration-150 flex flex-col min-h-[320px] ${
                col.key === 'DONE'
                  ? // DONE never becomes a full-column green overlay — the two
                    // drop targets carry all of its drag feedback.
                    isBlocked
                    ? 'border border-slate-200 bg-slate-50/60'
                    : 'border border-[#e0e2ec] bg-white'
                  : isOver
                  ? 'border-2 border-dashed border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-400/30'
                  : isBlocked
                  ? 'border border-slate-200 bg-slate-50/60'
                  : 'border border-[#e0e2ec] bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b-2 border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLUMN_DOTS[col.key]}`} />
                  <h4 className="text-xs font-bold text-[#1f1f1f] tracking-wide uppercase">{col.label}</h4>
                </div>
                <span
                  data-column-count={colTasks.length}
                  className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700"
                >
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 scrollbar-thin flex flex-col gap-2.5">
                {showDoneTargets && (
                  /* Drag-only drop targets: visible exclusively while a card is
                     dragged validly over DONE, gone the moment the drag ends. */
                  <div className="flex-1 min-h-0 flex flex-col gap-2.5">
                    {(['CANCELLED', 'DONE'] as const).map((zone) => (
                      <div
                        key={zone}
                        data-done-zone={zone}
                        onDragOver={(e) => handleDoneZoneDragOver(zone, e)}
                        onDrop={(e) => handleDoneZoneDrop(zone, e)}
                        className={`flex-1 min-h-[72px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-center transition-colors ${
                          doneZone === zone
                            ? zone === 'CANCELLED'
                              ? 'border-slate-400 bg-slate-100'
                              : 'border-emerald-500 bg-emerald-100'
                            : zone === 'CANCELLED'
                            ? 'border-slate-300 bg-slate-50'
                            : 'border-emerald-300 bg-emerald-50'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            zone === 'CANCELLED' ? 'text-slate-500' : 'text-emerald-700'
                          }`}
                        >
                          {zone === 'CANCELLED' ? 'Cancelled' : 'Done'}
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                          Drop here
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!hideDoneCards &&
                  (colTasks.length === 0 ? (
                  <div
                    className={`flex-1 min-h-[120px] rounded-xl border border-dashed flex flex-col items-center justify-center text-center text-xs transition-colors ${
                      isOver ? 'border-emerald-500 text-emerald-700 font-semibold bg-white/70' : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    <span>{isOver ? `Drop to move to ${col.label}` : `No items in ${col.label}`}</span>
                  </div>
                ) : (
                  orderedTasks.map((task) => {
                    const assignee = users.find((u: any) => u.id === task.assigneeId);
                    const epicTitle = resolveEpicTitle(task);
                    const typeBadge = TYPE_BADGE[task.type] || TYPE_BADGE.TASK;
                    const isDragging = draggingTaskId === task.id;
                    const isCancelled = isCancelledWorkItem(task);
                    const cardKey =
                      (task as SprintBoardTask).issueKey || resolveIssueKey(project, task);

                    return (
                      <div
                        key={task.id}
                        data-issue-key={cardKey}
                        draggable
                        onDragStart={(e) => handleCardDragStart(e, task.id)}
                        onDragEnd={resetDragState}
                        onDragOver={(e) => {
                          // Cards never sit inside a zone, so hovering one clears
                          // any zone highlight (same-column drags keep both).
                          setDoneZone(null);
                          const fromCol = draggingFromColumnRef.current;
                          const valid = fromCol ? canTransition(fromCol, col.key) : false;
                          if (!valid) return; // let it bubble so the column itself shows the blocked cursor
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          // A cross-column drag landing on an existing DONE card must still
                          // bubble up to the column: that's what reveals the Cancelled/Done
                          // drop targets (the cards, including this one, hide once it does).
                          if (col.key === 'DONE' && fromCol !== 'DONE') return;
                          e.stopPropagation();
                          setDragOverTaskId(task.id);
                        }}
                        onDrop={(e) => handleCardDrop(e, task, col.key)}
                        onClick={() => openTask(task.id)}
                        className={`bg-white rounded-lg p-2.5 border shadow-sm hover:shadow-md hover:border-[#1a73e8] cursor-grab active:cursor-grabbing transition-all group shrink-0 ${
                          isDragging ? 'opacity-40 scale-95 border-dashed border-[#1a73e8]' : 'border-[#e0e2ec]'
                        } ${dragOverTaskId === task.id && !isDragging ? 'ring-2 ring-[#1a73e8]/40' : ''} ${
                          isCancelled ? 'opacity-70' : ''
                        }`}
                      >
                        {/* Issue key first, assignee avatar pinned top-right. */}
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            onClick={(e) => { e.stopPropagation(); openTask(task.id); }}
                            className="text-[10px] font-bold text-[#747775] hover:text-[#1a73e8] hover:underline cursor-pointer truncate min-w-0"
                          >
                            {cardKey}
                          </span>
                          {assignee ? (
                            <div className="flex items-center gap-1 flex-shrink-0" title={assignee.name}>
                              <Avatar name={assignee.name} color={assignee.avatarColor} imageUrl={assignee.avatarUrl} size="xs" />
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic flex-shrink-0">Unassigned</span>
                          )}
                        </div>

                        <h5
                          onClick={(e) => { e.stopPropagation(); openTask(task.id); }}
                          className="text-xs font-bold text-[#1f1f1f] line-clamp-2 mb-1.5 cursor-pointer hover:text-[#1a73e8] leading-snug"
                        >
                          {task.title}
                        </h5>

                        {/* Epic / category as a compact colored label under the title. */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5 min-w-0">
                          {epicTitle && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border max-w-full truncate ${getEpicColor(epicTitle)}`}
                              title={`Epic: ${epicTitle}`}
                            >
                              {epicTitle}
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 flex items-center gap-0.5">
                              <Ban className="w-2.5 h-2.5" /> Cancelled
                            </span>
                          )}
                        </div>

                        {/* Compact bottom-left indicators: drag handle, type, story points. */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                          <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-[#1a73e8] flex-shrink-0" />
                          <span className={`text-[9px] font-bold px-1 rounded ${typeBadge.className}`}>{typeBadge.label}</span>
                          {task.storyPoints ? (
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                              {task.storyPoints} pts
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ))}
              </div>

              {/* Quick add */}
              {quickAddColumn === col.key ? (
                <div className="mt-2 flex items-center gap-1.5 flex-shrink-0">
                  <input
                    autoFocus
                    type="text"
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd(col.key);
                      if (e.key === 'Escape') { setQuickAddColumn(null); setQuickAddTitle(''); }
                    }}
                    placeholder="Work item title"
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md outline-none focus:border-[#1a73e8]"
                  />
                  <button type="button" onClick={() => handleQuickAdd(col.key)} className="p-1 rounded bg-[#1a73e8] text-white">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => { setQuickAddColumn(null); setQuickAddTitle(''); }} className="p-1 rounded bg-slate-100 text-slate-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickAddColumn(col.key)}
                  className="mt-2 py-1.5 px-2 rounded-xl border border-dashed border-transparent hover:border-[#1a73e8] hover:bg-white/80 text-[11px] font-semibold text-[#747775] hover:text-[#1a73e8] flex items-center justify-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to {col.label}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comment / screenshot modal (optional rich text + Ctrl+V screenshot) */}
      {showCommentModal && pendingTransition && (
        <div
          data-comment-modal
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
          onKeyDown={(e) => { if (e.key === 'Escape') closeCommentModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Transition dialog"
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1a73e8]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${getStatusColor(columnToStatus(pendingTransition.to))}`}>
                  {getStatusLabel(columnToStatus(pendingTransition.to))}
                </span>
              </div>
              <button type="button" onClick={closeCommentModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Moving to <strong className="text-slate-800">{BOARD_COLUMNS.find((c) => c.key === pendingTransition.to)?.label}</strong>.
                Comment is optional — paste a screenshot with Ctrl+V if useful.
              </p>
              <div>
                <label htmlFor="sk-transition-assignee" className="block text-xs font-semibold text-slate-700 mb-1">
                  Assignee
                </label>
                <select
                  id="sk-transition-assignee"
                  data-testid="transition-assignee"
                  value={pendingAssigneeId ?? ''}
                  onChange={(e) => setPendingAssigneeId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white outline-none focus:border-[#1a73e8]"
                >
                  <option value="">Unassigned</option>
                  {projectTeamMembers.map((member: { id: string; name: string }) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div
                className="rounded-lg border border-slate-200 focus-within:border-[#1a73e8] focus-within:ring-1 focus-within:ring-[#1a73e8] transition-colors overflow-hidden"
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
                  placeholder="Add a comment (optional)..."
                  minHeight="88px"
                  autoFocus
                  mentionableUsers={projectTeamMembers}
                  editableAttributes={{ 'data-comment-input': '' }}
                  onImagePaste={(dataUrl) => {
                    setPastedImage(imageFromDataUrl(dataUrl));
                    toast.info('Screenshot attached to comment');
                  }}
                />
              </div>
              {pastedImage && (
                <div data-paste-preview className="relative inline-block">
                  <img src={pastedImage.dataUrl} alt="Pasted screenshot" className="max-h-40 rounded-lg border border-slate-200" />
                  <button
                    type="button"
                    onClick={() => setPastedImage(null)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md hover:bg-slate-900"
                    title="Remove screenshot"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {!pastedImage && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Tip: copy a screenshot, click the comment box, then press Ctrl+V</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                data-action="comment-cancel"
                onClick={closeCommentModal}
                className="btn-secondary btn-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                data-action="comment-continue"
                onClick={confirmCommentModal}
                className="btn-primary btn-sm text-xs"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
