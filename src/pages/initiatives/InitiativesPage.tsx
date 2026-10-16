import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, X, Compass, Archive, ArchiveRestore, LayoutGrid, List, PauseCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ProgressBar } from '../../components/common/ProgressBar';
import { InitiativeKanbanBoard } from './InitiativeKanbanBoard';
import { InitiativeFormModal } from './InitiativeFormModal';
import { issuePath } from '../../utils/issueUrl';
import { formatShortDate, getDueDateClass } from '../../utils/dateUtils';
import { canAssignTasks, canArchiveSprint } from '../../utils/roleUtils';
import {
  INITIATIVE_BOARD_STATUS_LABEL,
  initiativeBoardStatusOf,
} from '../../utils/initiativeWorkflow';
import type { InitiativeBoardStatus } from '../../utils/initiativeWorkflow';
import { calculateInitiativeProgress, isInitiativeOverdue } from '../../utils/initiativeProgress';
import type { Priority, Task } from '../../types';

const PRIORITY_FILTERS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_FILTERS: InitiativeBoardStatus[] = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
];

/**
 * Initiative Management hub: searchable/filterable Initiative list plus the
 * 5-column Initiative Board, with create / edit / archive actions gated by
 * the existing role helpers. Archived Initiatives stay in the store and can
 * be restored — same convention as Sprint/Project archiving.
 */
export const InitiativesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { tasks, users, projects, updateTask } = useAppStore();

  const role = currentUser?.role;
  const canCreate = role ? canAssignTasks(role) : false;
  const canArchive = role ? canArchiveSprint(role) : false;

  const [view, setView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InitiativeBoardStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<Task | null>(null);

  const allInitiatives = useMemo(
    () => tasks.filter((t) => t.type === 'INITIATIVE'),
    [tasks]
  );

  const visibleInitiatives = useMemo(
    () => allInitiatives.filter((t) => (showArchived ? true : !t.isArchived)),
    [allInitiatives, showArchived]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visibleInitiatives.filter((t) => {
      if (needle) {
        const key = (t.issueKey ?? '').toLowerCase();
        const haystack = `${t.title} ${t.description ?? ''} ${key}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (statusFilter && initiativeBoardStatusOf(t.status) !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [visibleInitiatives, search, statusFilter, priorityFilter]);

  const hasActiveFilters = Boolean(search || statusFilter || priorityFilter);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
  };

  const handleArchiveToggle = (task: Task) => {
    if (!canArchive) {
      toast.error('You do not have permission to archive Initiatives.');
      return;
    }
    updateTask(task.id, { isArchived: !task.isArchived });
    toast.success(
      task.isArchived
        ? `Initiative "${task.title}" restored.`
        : `Initiative "${task.title}" archived.`
    );
    setArchiveTarget(null);
  };

  const userById = (id?: string) => users.find((u) => u.id === id);

  const renderRow = (task: Task) => {
    const boardStatus = initiativeBoardStatusOf(task.status);
    const owner = userById(task.assigneeId);
    const progress = calculateInitiativeProgress(task, tasks);
    const isOverdue = isInitiativeOverdue(task);
    const epicCount = task.linkedEpicIds?.length ?? 0;

    return (
      <div
        key={task.id}
        onClick={() => navigate(issuePath(task))}
        className={`group grid grid-cols-[minmax(0,2fr)_110px_96px_140px_120px_130px_72px] items-center gap-x-3 px-4 py-3 text-xs bg-white border-b border-[#f1f3f4] hover:bg-[#f8fafc] cursor-pointer transition-colors ${
          task.isArchived ? 'opacity-60' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[#b45309] flex-shrink-0" />
            {task.issueKey && (
              <span className="text-[10px] font-bold text-[#0052cc] flex-shrink-0">
                {task.issueKey}
              </span>
            )}
            <span className="font-semibold text-[#172b4d] truncate group-hover:text-[#0d9488] transition-colors">
              {task.title}
            </span>
            {task.isArchived && (
              <span className="badge badge-gray text-[9px] px-1.5 py-0 flex-shrink-0">ARCHIVED</span>
            )}
          </div>
          {task.description && (
            <p className="text-[10px] text-[#9ca3af] truncate mt-0.5">{task.description}</p>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide w-fit ${
            boardStatus === 'COMPLETED'
              ? 'badge-green'
              : boardStatus === 'ON_HOLD'
                ? 'badge-amber'
                : boardStatus === 'IN_PROGRESS'
                  ? 'badge-teal'
                  : boardStatus === 'PLANNED'
                    ? 'badge-indigo'
                    : 'badge-gray'
          }`}
        >
          {boardStatus === 'ON_HOLD' && <PauseCircle className="w-2.5 h-2.5" />}
          {INITIATIVE_BOARD_STATUS_LABEL[boardStatus]}
        </span>

        <PriorityBadge priority={task.priority} />

        <div className="min-w-0">
          {owner ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={owner.name} color={owner.avatarColor} size="xs" />
              <span className="text-[11px] text-[#5e6470] truncate">{owner.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-[#9ca3af]">Unassigned</span>
          )}
        </div>

        <div className="min-w-0">
          <div className={`text-[11px] font-medium ${getDueDateClass(task.dueDate)}`}>
            {task.dueDate ? formatShortDate(task.dueDate) : 'No target'}
          </div>
          {isOverdue && <div className="text-[9px] font-bold text-[#ef4444]">OVERDUE</div>}
        </div>

        <div className="min-w-0">
          <div className="text-[10px] text-[#5e6470] mb-1">
            {epicCount} Epic{epicCount === 1 ? '' : 's'}
          </div>
          {progress.hasLinkedWork && progress.percent !== null ? (
            <ProgressBar value={progress.percent} height="sm" color="#0d9488" />
          ) : (
            <span className="text-[10px] text-[#9ca3af]">No linked work</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canCreate && (
            <button
              onClick={() => setEditing(task)}
              className="px-2 py-1 rounded-md text-[10px] font-bold text-[#0d9488] hover:bg-[#ccfbf1] transition-colors"
            >
              Edit
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => setArchiveTarget(task)}
              className="p-1 rounded-md text-[#9aa0a6] hover:text-[#b45309] hover:bg-[#fffbeb] transition-colors"
              title={task.isArchived ? 'Restore Initiative' : 'Archive Initiative'}
            >
              {task.isArchived ? (
                <ArchiveRestore className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Initiatives</h1>
          <p className="page-subtitle">
            Portfolio-level Initiatives — plan, track and link Epics across delivery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#e2e5ea] bg-white p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                view === 'list' ? 'bg-[#ccfbf1] text-[#0f766e]' : 'text-[#5e6470] hover:bg-[#f8fafc]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                view === 'board'
                  ? 'bg-[#ccfbf1] text-[#0f766e]'
                  : 'text-[#5e6470] hover:bg-[#f8fafc]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Board
            </button>
          </div>
          {canCreate && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary btn-sm inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Initiative
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b778c]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Initiatives..."
            className="search-pill w-full pl-8 pr-8 py-1.5 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#1a1d23]"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InitiativeBoardStatus | '')}
          className="select text-xs py-1.5 w-36"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {INITIATIVE_BOARD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
          className="select text-xs py-1.5 w-32"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITY_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
            showArchived
              ? 'border-[#b45309] bg-[#fffbeb] text-[#b45309]'
              : 'border-[#e2e5ea] bg-white text-[#5e6470] hover:border-[#0d9488]/40'
          }`}
        >
          <Archive className="w-3 h-3" />
          Archived
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d93025] hover:underline"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {view === 'board' ? (
        <InitiativeKanbanBoard initiatives={filtered} />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_110px_96px_140px_120px_130px_72px] items-center gap-x-3 px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e5ea] text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
            <span>Initiative</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Owner</span>
            <span>Target</span>
            <span>Epics & Progress</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Compass className="w-8 h-8 text-[#cbd5e1] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#1a1d23]">
                {hasActiveFilters
                  ? 'No Initiatives match your filters'
                  : showArchived
                    ? 'No archived Initiatives'
                    : 'No Initiatives yet'}
              </p>
              <p className="text-xs text-[#9ca3af] mt-1">
                {hasActiveFilters
                  ? 'Try adjusting the search or clearing the filters.'
                  : canCreate
                    ? 'Create your first Initiative to start planning portfolio work.'
                    : 'Initiatives will appear here once a PM creates them.'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="btn-tonal btn-sm mt-3">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filtered.map(renderRow)
          )}
        </div>
      )}

      <InitiativeFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <InitiativeFormModal
        isOpen={Boolean(editing)}
        initiative={editing}
        onClose={() => setEditing(undefined)}
      />
      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && handleArchiveToggle(archiveTarget)}
        title={archiveTarget?.isArchived ? 'Restore Initiative' : 'Archive Initiative'}
        message={
          archiveTarget
            ? archiveTarget.isArchived
              ? `Restore "${archiveTarget.title}"? It will reappear in Initiative lists and the board.`
              : `Archive "${archiveTarget.title}"? It will be hidden from lists and the board until restored. Linked Epics are kept.`
            : ''
        }
        confirmLabel={archiveTarget?.isArchived ? 'Restore Initiative' : 'Archive Initiative'}
        danger={!archiveTarget?.isArchived}
      />
    </div>
  );
};
