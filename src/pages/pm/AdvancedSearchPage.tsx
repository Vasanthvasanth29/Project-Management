import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Bookmark, BookmarkCheck, Trash2, Plus, X,
  Save, Star, ChevronDown, ChevronRight, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TaskTypeBadge } from '../shared/tasks/TaskTypeBadge';
import { getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { getStatusLabel } from '../../utils/roleUtils';
import { issuePath } from '../../utils/issueUrl';
import { toast } from 'sonner';
import type { TaskStatus, Priority, EnhancedFilterState } from '../../types';

interface AdvancedSearchPageProps {
  projectId: string;
}

const FILTER_CHIPS = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigneeId', label: 'Assignee' },
  { key: 'teamId', label: 'Team' },
  { key: 'sprintId', label: 'Iteration' },
  { key: 'releaseId', label: 'Release' },
  { key: 'type', label: 'Type' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'blocked', label: 'Blocked' },
];

export const AdvancedSearchPage: React.FC<AdvancedSearchPageProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const { tasks, users, teams, sprints, releases, projects, savedFilters, saveFilter, deleteFilter, searchTasks, bulkSelectedTaskIds, toggleBulkSelect, clearBulkSelection, bulkUpdateStatus, bulkUpdatePriority, bulkDeleteTasks } = useAppStore();
  const { currentUser } = useAuthStore();

  const [filters, setFilters] = useState<EnhancedFilterState>({});
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expandedSaved, setExpandedSaved] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<string>('all');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteFilter, setConfirmDeleteFilter] = useState<{ id: string; name: string } | null>(null);

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const results = useMemo(() => searchTasks(projectId, filters), [searchTasks, projectId, filters]);
  const projectSavedFilters = savedFilters.filter((f) => f.userId === currentUser?.id);

  const updateFilter = (updates: Partial<EnhancedFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;
    saveFilter({ userId: currentUser?.id || '', name: filterName, filters });
    setShowSaveDialog(false);
    setFilterName('');
  };

  const handleApplySavedFilter = (savedFilter: typeof savedFilters[0]) => {
    setFilters(savedFilter.filters);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '' && v !== false);

  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '' && v !== false).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Query Builder Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6366f1] flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1a1d23]">Query Builder</h2>
              <p className="text-[11px] text-[#9ca3af]">Visually construct queries to find work items</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#9ca3af]">
            <span className="w-2 h-2 rounded-full bg-[#0d9488]" />
            <span>{results.length} results</span>
          </div>
        </div>
      </div>

      {/* Visual Query Builder */}
      <div className="card p-5">
        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => updateFilter({ search: e.target.value })}
            placeholder="Search by title, description, or ID..."
            className="input pl-9 text-xs"
          />
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Active Filters:</span>
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0d9488]/10 text-[#0d9488] text-[10px] font-semibold">
                Status: {filters.status} <button onClick={() => updateFilter({ status: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.priority && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444] text-[10px] font-semibold">
                Priority: {filters.priority} <button onClick={() => updateFilter({ priority: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.assigneeId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-[10px] font-semibold">
                Assignee: {users.find((u) => u.id === filters.assigneeId)?.name || filters.assigneeId} <button onClick={() => updateFilter({ assigneeId: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.teamId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] text-[10px] font-semibold">
                Team: {teams.find((t) => t.id === filters.teamId)?.name || filters.teamId} <button onClick={() => updateFilter({ teamId: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.sprintId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-semibold">
                Iteration: {sprints.find((s) => s.id === filters.sprintId)?.name || filters.sprintId} <button onClick={() => updateFilter({ sprintId: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.releaseId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#10b981]/10 text-[#10b981] text-[10px] font-semibold">
                Release: {releases.find((r) => r.id === filters.releaseId)?.name || filters.releaseId} <button onClick={() => updateFilter({ releaseId: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.overdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444] text-[10px] font-semibold">
                Overdue Only <button onClick={() => updateFilter({ overdue: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.blocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-semibold">
                Blocked Only <button onClick={() => updateFilter({ blocked: undefined })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            <button onClick={clearFilters} className="text-[10px] text-[#ef4444] font-semibold hover:underline ml-1">Clear All</button>
          </div>
        )}

        {/* Filter Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <select value={filters.status || ''} onChange={(e) => updateFilter({ status: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Status</option>
            {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'BUG_FIX', 'RETEST', 'BLOCKED', 'DONE'] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={filters.priority || ''} onChange={(e) => updateFilter({ priority: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Priority</option>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Priority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={filters.assigneeId || ''} onChange={(e) => updateFilter({ assigneeId: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Assignees</option>
            {users.filter((u) => u.status === 'ACTIVE').map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select value={filters.teamId || ''} onChange={(e) => updateFilter({ teamId: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={filters.sprintId || ''} onChange={(e) => updateFilter({ sprintId: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Iterations</option>
            {sprints.filter((s) => s.projectId === projectId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={filters.releaseId || ''} onChange={(e) => updateFilter({ releaseId: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Releases</option>
            {releases.filter((r) => r.projectId === projectId).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select value={filters.epicId || ''} onChange={(e) => updateFilter({ epicId: e.target.value || undefined })} className="input text-xs py-1.5">
            <option value="">All Epics</option>
            {projectTasks.filter((t) => t.type === 'EPIC').map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <input type="date" value={filters.dueDate || ''} onChange={(e) => updateFilter({ dueDate: e.target.value || undefined })} className="input text-xs py-1.5" />
        </div>

        {/* Boolean Filters */}
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-1.5 text-xs text-[#6b7280] cursor-pointer">
            <input type="checkbox" checked={filters.overdue || false} onChange={(e) => updateFilter({ overdue: e.target.checked || undefined })} className="w-3.5 h-3.5 rounded border-[#d1d5db]" />
            <span className="px-1.5 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] text-[10px] font-bold">Overdue</span> Only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#6b7280] cursor-pointer">
            <input type="checkbox" checked={filters.blocked || false} onChange={(e) => updateFilter({ blocked: e.target.checked || undefined })} className="w-3.5 h-3.5 rounded border-[#d1d5db]" />
            <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-bold">Blocked</span> Only
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#f1f3f4]">
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button onClick={() => setShowSaveDialog(true)} className="text-xs text-[#0d9488] hover:underline flex items-center gap-1 font-semibold">
                <Save className="w-3 h-3" /> Save Query
              </button>
            )}
          </div>
          {bulkSelectedTaskIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#0d9488] font-semibold">{bulkSelectedTaskIds.length} selected</span>
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  const next = e.target.value as TaskStatus;
                  const { updated, refused } = bulkUpdateStatus(next);
                  if (updated > 0) {
                    toast.success(`${updated} item${updated === 1 ? '' : 's'} updated to ${getStatusLabel(next)}`);
                  }
                  if (refused > 0) {
                    toast.error(
                      `${refused} Initiative${refused === 1 ? '' : 's'} could not move to ${getStatusLabel(next)} — Initiatives advance one step at a time through their workflow.`
                    );
                  }
                  e.target.value = '';
                }}
                defaultValue=""
                className="input text-xs py-1 w-28"
              >
                <option value="" disabled>Status</option>
                {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE'] as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <button onClick={() => setConfirmBulkDelete(true)} className="text-[#ef4444] hover:underline">Delete</button>
              <button onClick={clearBulkSelection} className="text-[#9ca3af] hover:underline">Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="card p-4 border-2 border-[#0d9488]/30 bg-[#f0fdfa] animate-slide-in">
          <h3 className="text-xs font-bold text-[#0d9488] mb-2">Save Current Query</h3>
          <div className="flex gap-2">
            <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Query name..." className="input text-xs flex-1" />
            <button onClick={handleSaveFilter} className="btn-primary btn-xs" disabled={!filterName.trim()}>Save</button>
            <button onClick={() => setShowSaveDialog(false)} className="btn-secondary btn-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Saved Filters */}
      {projectSavedFilters.length > 0 && (
        <div className="card p-4">
          <button onClick={() => setExpandedSaved(!expandedSaved)} className="flex items-center gap-2 text-xs font-bold text-[#1a1d23]">
            {expandedSaved ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Bookmark className="w-3.5 h-3.5 text-[#f59e0b]" />
            Saved Queries ({projectSavedFilters.length})
          </button>
          {expandedSaved && (
            <div className="mt-2 space-y-1">
              {projectSavedFilters.map((sf) => (
                <div key={sf.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#f8f9fb]">
                  <button onClick={() => handleApplySavedFilter(sf)} className="text-xs text-[#0d9488] hover:underline font-medium">
                    {sf.name}
                  </button>
                  <button onClick={() => setConfirmDeleteFilter({ id: sf.id, name: sf.name })} className="p-1 text-[#9ca3af] hover:text-[#ef4444]">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#f1f3f4] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1a1d23]">Results ({results.length})</h3>
          <div className="flex items-center gap-2 text-[10px] text-[#9ca3af]">
            <SlidersHorizontal className="w-3 h-3" />
            <span>{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e2e5ea] bg-[#f8f9fb] text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">
                <th className="px-4 py-2.5 w-10">
                  <input type="checkbox" onChange={() => {
                    const allIds = results.map((r) => r.id);
                    if (bulkSelectedTaskIds.length === allIds.length) clearBulkSelection();
                    else useAppStore.getState().selectAllTasks(allIds);
                  }} checked={results.length > 0 && bulkSelectedTaskIds.length === results.length} className="w-3.5 h-3.5" />
                </th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 min-w-[250px]">Title</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Assignee</th>
                <th className="px-4 py-2.5">Iteration</th>
                <th className="px-4 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] text-xs">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9ca3af]">
                    <div className="w-12 h-12 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6 text-[#6366f1]" />
                    </div>
                    <p className="text-xs font-bold text-[#1a1d23]">No results found</p>
                    <p className="text-[10px] text-[#9ca3af] mt-1">Try adjusting your query filters</p>
                  </td>
                </tr>
              ) : (
                results.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const sprint = sprints.find((s) => s.id === task.sprintId);
                  return (
                    <tr key={task.id} className="hover:bg-[#f8f9fb] cursor-pointer transition-colors" onClick={() => navigate(issuePath(task))}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={bulkSelectedTaskIds.includes(task.id)} onChange={() => toggleBulkSelect(task.id)} className="w-3.5 h-3.5" />
                      </td>
                      <td className="px-4 py-2.5"><TaskTypeBadge type={task.type} /></td>
                      <td className="px-4 py-2.5 font-semibold text-[#1a1d23] truncate">{task.title}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={task.status} resolution={task.resolution} /></td>
                      <td className="px-4 py-2.5"><PriorityBadge priority={task.priority} /></td>
                      <td className="px-4 py-2.5">
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                            <span className="truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-[#9ca3af]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[#6b7280]">{sprint?.name || '—'}</td>
                      <td className={`px-4 py-2.5 ${getDueDateClass(task.dueDate)}`}>{getDueDateLabel(task.dueDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          bulkDeleteTasks();
          setConfirmBulkDelete(false);
        }}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${bulkSelectedTaskIds.length} selected tasks? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
      <ConfirmDialog
        isOpen={!!confirmDeleteFilter}
        onClose={() => setConfirmDeleteFilter(null)}
        onConfirm={() => {
          if (confirmDeleteFilter) {
            deleteFilter(confirmDeleteFilter.id);
          }
          setConfirmDeleteFilter(null);
        }}
        title="Delete Saved Query"
        message={`Are you sure you want to delete "${confirmDeleteFilter?.name}"?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
};
