import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowUpDown, AlertTriangle, Users, CalendarRange, Clock, MoreVertical, Pencil, Archive } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CreateProjectModal } from '../admin/CreateProjectModal';
import { EditProjectModal } from '../admin/EditProjectModal';
import { FolderKanban } from 'lucide-react';
import { formatDate, isOverdue } from '../../utils/dateUtils';
import { toUrlId, getProjectUrl } from '../../utils/idUtils';
import { canCreateProjects, canManageProjectSettings, canArchiveProjects } from '../../utils/roleUtils';
import type { Project, ProjectStatus } from '../../types';

type SortKey = 'name' | 'progress' | 'targetDate' | 'updatedAt';

const STATUS_FILTERS: { value: ProjectStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'progress', label: 'Progress' },
  { value: 'targetDate', label: 'Due Date' },
  { value: 'updatedAt', label: 'Recently Updated' },
];

const statusBadgeClass = (status: ProjectStatus): string => {
  switch (status) {
    case 'ACTIVE': return 'badge-green';
    case 'PLANNING': return 'badge-blue';
    case 'COMPLETED': return 'badge-teal';
    case 'ON_HOLD': return 'badge-amber';
    case 'CANCELLED': return 'badge-red';
    default: return 'badge-gray';
  }
};

export const PMProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { projects, users, workflows, sprints, teams, tasks, updateProject } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const role = currentUser?.role;
  // Project administration guards (roleUtils) — Admin & PM may manage projects,
  // Team Leaders and Members are read-only.
  const canCreate = canCreateProjects(role);
  const canEdit = canManageProjectSettings(role);
  const canArchive = canArchiveProjects(role);

  // Close the card action menu when clicking outside of it.
  useEffect(() => {
    if (!menuFor) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuFor]);

  // ADMIN and PROJECT_MANAGER see every project (Access Any Project);
  // TEAM_LEADER stays scoped to the projects where it leads an iteration.
  // Archived projects stay hidden until they are restored.
  const activeProjects = projects.filter((p) => !p.isArchived);
  const myProjects = currentUser?.role === 'TEAM_LEADER'
    ? activeProjects.filter((p) => sprints.some((s) => s.projectId === p.id && s.teamLeaderId === currentUser?.id))
    : activeProjects;

  const handleArchiveToggle = () => {
    if (!archiveTarget) return;
    updateProject(archiveTarget.id, { isArchived: !archiveTarget.isArchived });
    setArchiveTarget(null);
    setMenuFor(null);
  };

  const enriched = useMemo(() => {
    return myProjects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const overdueCount = projectTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate)).length;
      const projectTeams = teams.filter((t) => project.teamIds.includes(t.id));
      const pm = users.find((u) => u.id === project.projectManagerId);
      const workflow = workflows.find((w) => w.id === project.workflowId);
      const currentStage = workflow?.stages.find((s) => s.id === project.currentStageId);
      return { ...project, overdueCount, projectTeams, pm, currentStage };
    });
  }, [myProjects, tasks, teams, users, workflows]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter);
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'progress': cmp = a.progress - b.progress; break;
        case 'targetDate': cmp = (a.targetDate || '').localeCompare(b.targetDate || ''); break;
        case 'updatedAt': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [enriched, search, statusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">
            {currentUser?.role === 'TEAM_LEADER' ? 'My Projects' : 'All Projects'}
          </h1>
          <p className="page-subtitle">
            {currentUser?.role === 'TEAM_LEADER'
              ? `${myProjects.length} project${myProjects.length !== 1 ? 's' : ''} assigned to you`
              : `${myProjects.length} project${myProjects.length !== 1 ? 's' : ''} across the organization`}
          </p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Search + Status Filter + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search projects..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 w-full" />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === sf.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="select text-xs py-1.5"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            {sortAsc ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={FolderKanban} title="No projects found"
            description={search || statusFilter !== 'ALL'
              ? "Try adjusting your filters"
              : currentUser?.role === 'TEAM_LEADER'
              ? "The Admin will assign projects to you."
              : "No projects exist in this organization yet."} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {filtered.map((project) => {
            const isProjectOverdue = project.targetDate && isOverdue(project.targetDate) && project.status !== 'COMPLETED';
            return (
              <div key={project.id} className="card-hover p-5 cursor-pointer flex flex-col justify-between"
                onClick={() => navigate(getProjectUrl(project, currentUser?.role))}>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 mr-2">
                      {project.key && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {project.key}
                        </span>
                      )}
                      <h3 className="text-base font-bold text-slate-900 truncate">{project.name}</h3>
                      {project.category && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
                          {project.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {isProjectOverdue && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                      <span className={`badge text-[10px] ${statusBadgeClass(project.status)}`}>{project.status.replace('_', ' ')}</span>
                      {(canEdit || canArchive) && (
                        <div className="relative" ref={menuFor === project.id ? menuRef : undefined}>
                          <button
                            type="button"
                            title="Project actions"
                            aria-label="Project actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(menuFor === project.id ? null : project.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuFor === project.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuFor(null);
                                    setEditingProject(project);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-slate-400" /> Project Settings
                                </button>
                              )}
                              {canArchive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuFor(null);
                                    setArchiveTarget(project);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <Archive className="w-3.5 h-3.5 text-amber-600" /> Archive Project
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>

                  <ProgressBar value={project.progress} showLabel height="sm" className="mb-3" />

                  {project.currentStage && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.currentStage.color }} />
                      Stage: <span className="font-medium text-slate-700">{project.currentStage.name}</span>
                    </div>
                  )}

                  {/* Project owner + team */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                    {project.pm && (
                      <div className="flex items-center gap-1">
                        <Avatar name={project.pm.name} color={project.pm.avatarColor} size="xs" />
                        <span className="font-medium text-slate-600">{project.pm.name}</span>
                      </div>
                    )}
                    {project.projectTeams.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{project.projectTeams.map((t) => t.name).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overdue count + dates */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 mt-3 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <CalendarRange className="w-3 h-3" />
                      {formatDate(project.targetDate)}
                    </span>
                    {project.overdueCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500 font-semibold">
                        <Clock className="w-3 h-3" /> {project.overdueCount} overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      {project.id}
                    </span>
                    <span className="badge-gray">{project.type}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} />}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveToggle}
        title="Archive Project"
        message={archiveTarget ? `Archive "${archiveTarget.name}"? It will be hidden from project lists until restored. Existing work items are kept.` : ''}
        confirmLabel="Archive Project"
      />
    </div>
  );
};
