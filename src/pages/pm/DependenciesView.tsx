import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2, ArrowRight, AlertTriangle, Filter, Search, Eye, X,
  GitBranch, ArrowDown, ArrowUp, Minus
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { TaskTypeBadge } from '../shared/tasks/TaskTypeBadge';
import { getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { issuePath } from '../../utils/issueUrl';
import type { Task, TaskDependency, DependencyType } from '../../types';

interface DependenciesViewProps {
  projectId: string;
}

interface DependencyEdge {
  id: string;
  from: Task;
  to: Task;
  type: DependencyType;
  crossTeam: boolean;
  crossSprint: boolean;
  crossRelease: boolean;
  isBlocked: boolean;
}

export const DependenciesView: React.FC<DependenciesViewProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const { tasks, taskDependencies, users, teams, sprints, releases, projects, removeTaskDependency, addTaskDependency } = useAppStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DependencyType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTeam, setFilterTeam] = useState<string>('ALL');
  const [filterSprint, setFilterSprint] = useState<string>('ALL');
  const [filterRelease, setFilterRelease] = useState<string>('ALL');
  const [filterBlocked, setFilterBlocked] = useState<'ALL' | 'BLOCKED' | 'NOT_BLOCKED'>('ALL');
  const [selectedEdge, setSelectedEdge] = useState<DependencyEdge | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [showAddDep, setShowAddDep] = useState(false);
  const [addDepFrom, setAddDepFrom] = useState('');
  const [addDepTo, setAddDepTo] = useState('');
  const [addDepType, setAddDepType] = useState<DependencyType>('BLOCKS');

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const projectDeps = useMemo(() => {
    const taskIds = new Set(projectTasks.map((t) => t.id));
    return taskDependencies.filter((d) => taskIds.has(d.taskId) || taskIds.has(d.dependsOnTaskId));
  }, [taskDependencies, projectTasks]);

  const taskMap = useMemo(() => new Map(projectTasks.map((t) => [t.id, t])), [projectTasks]);

  const edges = useMemo((): DependencyEdge[] => {
    return projectDeps.map((dep) => {
      const from = taskMap.get(dep.taskId);
      const to = taskMap.get(dep.dependsOnTaskId);
      if (!from || !to) return null;

      const fromTeam = teams.find((t) => t.id === from.teamId);
      const toTeam = teams.find((t) => t.id === to.teamId);
      const fromSprint = sprints.find((s) => s.id === from.sprintId);
      const toSprint = sprints.find((s) => s.id === to.sprintId);
      const fromRelease = releases.find((r) => r.id === from.releaseId);
      const toRelease = releases.find((r) => r.id === to.releaseId);

      const isBlocked = dep.type === 'BLOCKED_BY' && to.status === 'BLOCKED';
      const isSourceBlocked = dep.type === 'BLOCKS' && from.status === 'BLOCKED';

      return {
        id: dep.id,
        from,
        to,
        type: dep.type,
        crossTeam: from.teamId !== to.teamId && from.teamId && to.teamId,
        crossSprint: from.sprintId !== to.sprintId && from.sprintId && to.sprintId,
        crossRelease: from.releaseId !== to.releaseId && from.releaseId && to.releaseId,
        isBlocked: isBlocked || isSourceBlocked,
      };
    }).filter(Boolean) as DependencyEdge[];
  }, [projectDeps, taskMap, teams, sprints, releases]);

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => {
      if (filterType !== 'ALL' && edge.type !== filterType) return false;
      if (filterBlocked === 'BLOCKED' && !edge.isBlocked) return false;
      if (filterBlocked === 'NOT_BLOCKED' && edge.isBlocked) return false;
      if (filterStatus !== 'ALL') {
        if (edge.from.status !== filterStatus && edge.to.status !== filterStatus) return false;
      }
      if (filterTeam !== 'ALL') {
        if (edge.from.teamId !== filterTeam && edge.to.teamId !== filterTeam) return false;
      }
      if (filterSprint !== 'ALL') {
        if (edge.from.sprintId !== filterSprint && edge.to.sprintId !== filterSprint) return false;
      }
      if (filterRelease !== 'ALL') {
        if (edge.from.releaseId !== filterRelease && edge.to.releaseId !== filterRelease) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!edge.from.title.toLowerCase().includes(q) && !edge.to.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [edges, filterType, filterStatus, filterTeam, filterSprint, filterRelease, filterBlocked, search]);

  const stats = useMemo(() => {
    const total = edges.length;
    const blocked = edges.filter((e) => e.isBlocked).length;
    const crossTeam = edges.filter((e) => e.crossTeam).length;
    const crossSprint = edges.filter((e) => e.crossSprint).length;
    const crossRelease = edges.filter((e) => e.crossRelease).length;
    const blocks = edges.filter((e) => e.type === 'BLOCKS').length;
    const blockedBy = edges.filter((e) => e.type === 'BLOCKED_BY').length;
    const relatesTo = edges.filter((e) => e.type === 'RELATES_TO').length;
    return { total, blocked, crossTeam, crossSprint, crossRelease, blocks, blockedBy, relatesTo };
  }, [edges]);

  const handleAddDependency = () => {
    if (!addDepFrom || !addDepTo || addDepFrom === addDepTo) return;
    addTaskDependency(addDepFrom, addDepTo, addDepType);
    setShowAddDep(false);
    setAddDepFrom('');
    setAddDepTo('');
  };

  const getTypeIcon = (type: DependencyType) => {
    switch (type) {
      case 'BLOCKS': return <ArrowRight className="w-3.5 h-3.5 text-[#ef4444]" />;
      case 'BLOCKED_BY': return <ArrowDown className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'RELATES_TO': return <Minus className="w-3.5 h-3.5 text-[#0d9488]" />;
      case 'MENTIONED_IN': return <Minus className="w-3.5 h-3.5 text-[#3b82f6]" />;
    }
  };

  const getTypeColor = (type: DependencyType) => {
    switch (type) {
      case 'BLOCKS': return 'bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]';
      case 'BLOCKED_BY': return 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]';
      case 'RELATES_TO': return 'bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]';
      case 'MENTIONED_IN': return 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]';
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Dependencies</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Blocked</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.crossTeam}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cross-Team</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.crossSprint}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cross-Iteration</div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="input text-xs pl-8 py-1.5 w-48"
              />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="select text-xs py-1.5">
              <option value="ALL">All Types</option>
              <option value="BLOCKS">Blocks</option>
              <option value="BLOCKED_BY">Blocked By</option>
              <option value="RELATES_TO">Relates To</option>
              <option value="MENTIONED_IN">Mentioned In</option>
            </select>
            <select value={filterBlocked} onChange={(e) => setFilterBlocked(e.target.value as any)} className="select text-xs py-1.5">
              <option value="ALL">All Status</option>
              <option value="BLOCKED">Blocked Only</option>
              <option value="NOT_BLOCKED">Not Blocked</option>
            </select>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="select text-xs py-1.5">
              <option value="ALL">All Teams</option>
              {teams.filter((t) => t.organizationId === 'org-001').map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select value={filterSprint} onChange={(e) => setFilterSprint(e.target.value)} className="select text-xs py-1.5">
              <option value="ALL">All Iterations</option>
              {sprints.filter((s) => s.projectId === projectId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={filterRelease} onChange={(e) => setFilterRelease(e.target.value)} className="select text-xs py-1.5">
              <option value="ALL">All Releases</option>
              {releases.filter((r) => r.projectId === projectId).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowAddDep(true)} className="btn-primary btn-xs flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> Add Dependency
          </button>
        </div>
      </div>

      {/* Add Dependency Modal */}
      {showAddDep && (
        <div className="card p-4 border-2 border-[#ccfbf1] bg-[#f0fdfa]/50 animate-slide-in">
          <h3 className="text-xs font-bold text-[#0f766e] mb-3">Add Dependency</h3>
          <div className="grid grid-cols-3 gap-3">
            <select value={addDepFrom} onChange={(e) => setAddDepFrom(e.target.value)} className="input text-xs">
              <option value="">Select source task...</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <select value={addDepType} onChange={(e) => setAddDepType(e.target.value as any)} className="input text-xs">
              <option value="BLOCKS">Blocks</option>
              <option value="BLOCKED_BY">Blocked By</option>
              <option value="RELATES_TO">Relates To</option>
              <option value="MENTIONED_IN">Mentioned In</option>
            </select>
            <select value={addDepTo} onChange={(e) => setAddDepTo(e.target.value)} className="input text-xs">
              <option value="">Select target task...</option>
              {projectTasks.filter((t) => t.id !== addDepFrom).map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowAddDep(false)} className="btn-secondary btn-xs">Cancel</button>
            <button onClick={handleAddDependency} className="btn-primary btn-xs" disabled={!addDepFrom || !addDepTo}>Add</button>
          </div>
        </div>
      )}

      {/* Dependency List */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredEdges.length === 0 ? (
            <div className="p-8 text-center">
              <Link2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No dependencies found</p>
            </div>
          ) : (
            filteredEdges.map((edge) => (
              <div
                key={edge.id}
                className={`p-4 hover:bg-[#f8fafc] transition-colors cursor-pointer ${edge.isBlocked ? 'bg-[#fef2f2]/50' : ''}`}
                onClick={() => setSelectedEdge(selectedEdge?.id === edge.id ? null : edge)}
              >
                <div className="flex items-center gap-3">
                  {/* Source Task */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(issuePath(edge.from.id)); }}
                    className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                  >
                    <TaskTypeBadge type={edge.from.type} />
                    <span className="text-xs font-semibold text-slate-800 truncate">{edge.from.title}</span>
                    <StatusBadge status={edge.from.status} resolution={edge.from.resolution} />
                  </button>

                  {/* Dependency Arrow */}
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold ${getTypeColor(edge.type)}`}>
                    {getTypeIcon(edge.type)}
                    <span>{edge.type.replace(/_/g, ' ')}</span>
                  </div>

                  {/* Target Task */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(issuePath(edge.to.id)); }}
                    className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                  >
                    <TaskTypeBadge type={edge.to.type} />
                    <span className="text-xs font-semibold text-slate-800 truncate">{edge.to.title}</span>
                    <StatusBadge status={edge.to.status} resolution={edge.to.resolution} />
                  </button>

                  {/* Indicators */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {edge.crossTeam && (
                      <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-[#f3e8ff] text-[#7e22ce] border border-[#e9d5ff]">Cross-Team</span>
                    )}
                    {edge.crossSprint && (
                      <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-[#cffafe] text-[#0891b2] border border-[#a5f3fc]">Cross-Iteration</span>
                    )}
                    {edge.crossRelease && (
                      <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-[#d1fae5] text-[#047857] border border-[#a7f3d0]">Cross-Release</span>
                    )}
                    {edge.isBlocked && (
                      <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTaskDependency(edge.id); }}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
