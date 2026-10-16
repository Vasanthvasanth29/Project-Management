import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, CalendarRange, AlertTriangle, Eye, CheckCircle, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CreateProjectModal } from './CreateProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { formatDate, isOverdue, isDateInRange } from '../../utils/dateUtils';
import { toUrlId, getProjectUrl } from '../../utils/idUtils';
import type { Project } from '../../types';

export const AdminProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, users, tasks, sprints, updateProject, deleteProject } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'>('ACTIVE');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Close the card action menu when clicking anywhere outside of it.
  useEffect(() => {
    if (!menuFor) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuFor]);

  // Archived projects only surface under the explicit "Archived" filter.
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'ARCHIVED'
          ? p.isArchived === true
          : statusFilter === 'ALL'
          ? !p.isArchived
          : !p.isArchived && p.status === statusFilter;
      const matchesDate = isDateInRange(p.targetDate, fromDate, toDate);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [projects, search, statusFilter, fromDate, toDate]);

  const handleArchiveToggle = () => {
    if (!archiveTarget) return;
    const next = !archiveTarget.isArchived;
    updateProject(archiveTarget.id, { isArchived: next });
    setArchiveTarget(null);
    setMenuFor(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id);
    setDeleteTarget(null);
    setMenuFor(null);
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'badge-green',
    PLANNING: 'badge-blue',
    ON_HOLD: 'badge-amber',
    COMPLETED: 'badge-gray',
    CANCELLED: 'badge-red',
    ARCHIVED: 'badge-purple',
  };

  const visibleProjects = projects.filter((p) => !p.isArchived);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{visibleProjects.length} total · {visibleProjects.filter(p=>p.status==='ACTIVE').length} active · {projects.filter(p=>p.isArchived).length} archived</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        <DateRangeFilter
          compact
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onClear={() => {
            setFromDate('');
            setToDate('');
          }}
          label="Target Due"
        />

        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'All Projects' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'PLANNING', label: 'Planning' },
            { id: 'ON_HOLD', label: 'On Hold' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled' },
            { id: 'ARCHIVED', label: 'Archived' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No projects yet"
            description="Create your first project and assign a Project Manager to begin execution."
            action={{ label: 'Create Project', onClick: () => setShowCreate(true) }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {filtered.map((project) => {
            const pm = users.find((u) => u.id === project.projectManagerId);
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
            const doneTasks = projectTasks.filter((t) => t.status === 'DONE').length;
            const totalTasks = projectTasks.length;
            const projectSprints = sprints.filter((s) => s.projectId === project.id);
            const activeSprint = projectSprints.find((s) => s.status === 'ACTIVE');
            const completedSprints = projectSprints.filter((s) => s.status === 'COMPLETED').length;
            const overdue = isOverdue(project.targetDate) && project.status !== 'COMPLETED';

            return (
              <div
                key={project.id}
                onClick={() => navigate(getProjectUrl(project, 'ADMIN'))}
                className="card-hover p-5 cursor-pointer hover:border-blue-300 transition-all group flex flex-col justify-between"
              >
                <div className="flex-1">
                  {/* Header: Name + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {project.key && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            {project.key}
                          </span>
                        )}
                        <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-[#1a73e8] transition-colors">{project.name}</h3>
                        <span className={statusColors[project.status]}>{project.status}</span>
                        {project.isArchived && <span className="badge-purple">ARCHIVED</span>}
                        {project.category && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
                            {project.category}
                          </span>
                        )}
                        {overdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{project.description}</p>
                    </div>

                    {/* Admin project actions: open / edit / archive / delete */}
                    <div className="relative flex-shrink-0" ref={menuFor === project.id ? menuRef : undefined}>
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
                        <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(null);
                              navigate(getProjectUrl(project, 'ADMIN'));
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> Open Project
                          </button>
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(null);
                              setArchiveTarget(project);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                          >
                            {project.isArchived ? (
                              <>
                                <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" /> Restore Project
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5 text-amber-600" /> Archive Project
                              </>
                            )}
                          </button>
                          <div className="my-1 h-px bg-slate-100" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(null);
                              setDeleteTarget(project);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <ProgressBar value={project.progress} showLabel height="sm" className="mb-4" />

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tasks</span>
                      <span className="font-semibold text-slate-700">{doneTasks}/{totalTasks} Done</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Live Iteration</span>
                      <span className="font-semibold text-slate-700">{activeSprint ? activeSprint.name : 'None'}</span>
                    </div>
                  </div>
                </div>

                {/* PM + Footer */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 mt-3 border-t border-slate-100">
                  {pm ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={pm.name} color={pm.avatarColor} size="xs" />
                      <div>
                        <span className="font-semibold text-slate-700 block">{pm.name}</span>
                        <span className="text-[10px] text-slate-400">Project Manager</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No PM Assigned</span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      {project.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <CalendarRange className="w-3 h-3" />
                      <span>Due {formatDate(project.targetDate)}</span>
                    </div>
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
        title={archiveTarget?.isArchived ? 'Restore Project' : 'Archive Project'}
        message={
          archiveTarget
            ? archiveTarget.isArchived
              ? `Restore "${archiveTarget.name}"? It will become visible in project lists again.`
              : `Archive "${archiveTarget.name}"? It will be hidden from project lists until restored. Existing work items are kept.`
            : ''
        }
        confirmLabel={archiveTarget?.isArchived ? 'Restore' : 'Archive'}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}" along with its iterations, releases and work items? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Project"
        danger
      />
    </div>
  );
};
