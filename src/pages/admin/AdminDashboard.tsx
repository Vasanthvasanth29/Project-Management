import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FolderKanban, Plus, Mail, Clock,
  Activity, CheckCircle, AlertCircle, TrendingUp, UsersRound,
  Briefcase, Sparkles, CheckSquare, ArrowRight, CalendarRange,
  RefreshCw, Trash2, AlertTriangle, XCircle, Eye, Settings2
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { useOrganizationBranding } from '../../store/adminSettingsStore';
import { StatCard } from '../../components/common/StatCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { UserStatusBadge, RoleBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ActivityFeed } from '../../components/common/ActivityFeed';
import { formatDate, isOverdue, getDueDateLabel } from '../../utils/dateUtils';
import { toUrlId, getProjectUrl } from '../../utils/idUtils';
import { CreateUserModal } from './CreateUserModal';
import { CreateProjectModal } from './CreateProjectModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from 'sonner';

type ActivityFilter = 'ALL' | 'USER' | 'PROJECT' | 'TASK' | 'BUG' | 'SPRINT';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const branding = useOrganizationBranding();
  const { users, tasks, projects, activities, sprints, bugs, resendInvitation, deactivateUser } = useAppStore();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');
  const [confirmCancel, setConfirmCancel] = useState<{ userId: string; userName: string } | null>(null);

  const activeUsers = users.filter((u) => u.status === 'ACTIVE');
  const pendingInvitations = users.filter((u) => u.status === 'INVITATION_PENDING');
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE' && !p.isArchived);
  const pms = users.filter((u) => u.role === 'PROJECT_MANAGER');
  const leaders = users.filter((u) => u.role === 'TEAM_LEADER');
  const members = users.filter((u) => u.role === 'MEMBER');

  const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
  const openTasks = tasks.filter((t) => t.status !== 'DONE').length;
  const overdueTasks = tasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate)).length;
  const avgProjectProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
    : 0;

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'ALL') return activities;
    return activities.filter((a) => {
      switch (activityFilter) {
        case 'USER': return a.entityType === 'USER';
        case 'PROJECT': return a.entityType === 'PROJECT';
        case 'TASK': return a.entityType === 'TASK';
        case 'BUG': return a.entityType === 'BUG';
        case 'SPRINT': return a.entityType === 'SPRINT';
        default: return true;
      }
    });
  }, [activities, activityFilter]);

  const auditLog = useMemo(() => {
    return activities.filter((a) =>
      a.action.includes('created') ||
      a.action.includes('deleted') ||
      a.action.includes('assigned project') ||
      a.action.includes('updated status') ||
      a.action.includes('started sprint') ||
      a.action.includes('completed sprint')
    ).slice(0, 10);
  }, [activities, users]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const activityFilters: { key: ActivityFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'USER', label: 'Users' },
    { key: 'PROJECT', label: 'Projects' },
    { key: 'TASK', label: 'Tasks' },
    { key: 'BUG', label: 'Bugs' },
    { key: 'SPRINT', label: 'Iterations' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #4338ca 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 50%)' }} />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#a5b4fc] text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              Organization Admin Console
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display">
              {greeting()}, {currentUser?.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Organization overview &amp; administrative controls for {branding.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={() => navigate('/admin/settings')}>
              <Settings2 className="w-4 h-4 text-[#0d9488]" />
              <span>Admin Settings</span>
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setShowCreateProject(true)}>
              <FolderKanban className="w-4 h-4 text-[#0d9488]" />
              <span>New Project</span>
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowCreateUser(true)}>
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} icon={Users} iconColor="#0d9488" iconBg="#ccfbf1"
          trend={activeUsers.length} trendLabel="active users" />
        <StatCard title="Active Projects" value={activeProjects.length} icon={FolderKanban} iconColor="#6366f1" iconBg="#e0e7ff"
          badge="Active" badgeColor="badge-green" />
        <StatCard title="Total Tasks" value={tasks.length} icon={CheckSquare} iconColor="#06b6d4" iconBg="#cffafe"
          trend={completedTasks} trendLabel="completed" />
        <StatCard title="Pending Invites" value={pendingInvitations.length} icon={Mail} iconColor="#f59e0b" iconBg="#fef3c7"
          badge={pendingInvitations.length > 0 ? 'Needs Attention' : undefined} badgeColor="badge-amber" />
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Project Managers', count: pms.length, color: '#0d9488', bg: '#ccfbf1' },
          { label: 'Team Leaders', count: leaders.length, color: '#6366f1', bg: '#e0e7ff' },
          { label: 'Engineers & Members', count: members.length, color: '#f59e0b', bg: '#fef3c7' },
        ].map((item) => (
          <div key={item.label} className="card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
              <span className="text-xl font-bold font-display" style={{ color: item.color }}>{item.count}</span>
            </div>
            <div className="text-xs font-bold text-[#1a1d23]">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Organization Analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#d1fae5] flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-[#10b981]" />
            </div>
            <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Completed</span>
          </div>
          <div className="text-2xl font-bold text-[#059669] font-display">{completedTasks}</div>
          <div className="text-[10px] text-[#9ca3af] mt-1">tasks done</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#ccfbf1] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#0d9488]" />
            </div>
            <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Open</span>
          </div>
          <div className="text-2xl font-bold text-[#0d9488] font-display">{openTasks}</div>
          <div className="text-[10px] text-[#9ca3af] mt-1">tasks in progress</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#fee2e2] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            </div>
            <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-[#dc2626] font-display">{overdueTasks}</div>
          <div className="text-[10px] text-[#9ca3af] mt-1">tasks overdue</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Avg Progress</span>
          </div>
          <div className="text-2xl font-bold text-[#d97706] font-display">{avgProjectProgress}%</div>
          <div className="text-[10px] text-[#9ca3af] mt-1">across projects</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
            <h2 className="section-title mb-0">Active Projects</h2>
            <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e] flex items-center gap-1"
              onClick={() => navigate('/admin/projects')}>
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {activeProjects.map((project) => {
              const pm = users.find((u) => u.id === project.projectManagerId);
              const projectTasks = tasks.filter((t) => t.projectId === project.id);
              const doneTasks = projectTasks.filter((t) => t.status === 'DONE').length;
              const totalTasks = projectTasks.length;
              const projectSprints = sprints.filter((s) => s.projectId === project.id);
              const activeSprint = projectSprints.find((s) => s.status === 'ACTIVE');
              const overdue = isOverdue(project.targetDate) && project.status !== 'COMPLETED';

              return (
                <div key={project.id} onClick={() => navigate(getProjectUrl(project, 'ADMIN'))}
                  className="p-4 rounded-xl bg-[#f8fafc] hover:bg-[#f0fdfa] transition-colors cursor-pointer border border-[#f1f5f9] group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-[#1a1d23] truncate font-display group-hover:text-[#0d9488] transition-colors">{project.name}</div>
                    <div className="flex items-center gap-2">
                      {overdue && (
                        <span className="badge-red text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                      <span className={`badge ${project.status === 'ACTIVE' ? 'badge-green' : project.status === 'PLANNING' ? 'badge-teal' : 'badge-gray'} text-[11px]`}>
                        {project.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#9ca3af] mb-3 flex-wrap">
                    {pm && (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={pm.name} color={pm.avatarColor} size="xs" />
                        <span className="font-medium text-[#4b5563]">{pm.name}</span>
                      </div>
                    )}
                    <span className="text-[#e2e8f0]">·</span>
                    <div className="flex items-center gap-1">
                      <CalendarRange className="w-3 h-3" />
                      <span>Target: {formatDate(project.targetDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex-1">
                      <ProgressBar value={project.progress} height="sm" color="#0d9488" showLabel />
                    </div>
                    <div className="text-[11px] font-bold text-[#4b5563] flex-shrink-0">
                      <span className="text-[#059669]">{doneTasks}</span>
                      <span className="text-[#e2e8f0]"> / </span>
                      <span>{totalTasks} tasks</span>
                    </div>
                  </div>

                  {activeSprint && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#9ca3af] mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                      <span className="font-semibold">{activeSprint.name}</span>
                      <span>active</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-2 pt-2 border-t border-[#f1f5f9]">
                    <span className="text-[11px] font-bold text-[#0d9488] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-3 h-3" />
                      View Project
                    </span>
                  </div>
                </div>
              );
            })}
            {activeProjects.length === 0 && (
              <div className="py-8 text-center">
                <FolderKanban className="w-10 h-10 text-[#e2e8f0] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#4b5563]">No active projects</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Create a project to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        <div className="card p-6">
          <h2 className="section-title mb-3">Pending Invitations</h2>
          {pendingInvitations.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle className="w-9 h-9 text-[#10b981] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[#4b5563]">All invitations accepted</p>
              <p className="text-[11px] text-[#9ca3af] mt-1">No pending invitations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingInvitations.map((user) => (
                <div key={user.id} className="p-3 rounded-xl bg-[#fef3c7]/30 border border-[#fde68a]">
                  <div className="flex items-start gap-3 mb-2">
                    <Avatar name={user.name} color={user.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#1a1d23] truncate">{user.name}</div>
                      <div className="text-[11px] text-[#9ca3af] truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={user.role} />
                    <span className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-[#fde68a]/60">
                    <button className="btn-secondary btn-sm flex-1 text-xs px-2 py-1"
                      onClick={() => { resendInvitation(user.id); toast.success(`Invitation resent to ${user.name}`); }}>
                      <RefreshCw className="w-3 h-3 text-[#0d9488]" />
                      Resend
                    </button>
                    <button className="btn-ghost btn-sm text-xs px-2 py-1 text-[#dc2626] hover:bg-[#fee2e2]"
                      onClick={() => setConfirmCancel({ userId: user.id, userName: user.name })}>
                      <XCircle className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity + Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
            <h2 className="section-title mb-0">Recent Organization Activity</h2>
            <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e] flex items-center gap-1"
              onClick={() => navigate('/admin/activity')}>
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {activityFilters.map((f) => (
              <button key={f.key} onClick={() => setActivityFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activityFilter === f.key
                    ? 'bg-[#f0fdfa] text-[#0d9488] border border-[#ccfbf1]'
                    : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0] border border-transparent'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <ActivityFeed activities={filteredActivities} limit={8} />
        </div>

        <div className="card p-6">
          <h2 className="section-title mb-3">Audit Log</h2>
          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
                <p className="text-xs text-[#9ca3af]">No audit events yet</p>
              </div>
            ) : (
              auditLog.map((entry) => {
                const actor = users.find((u) => u.id === entry.userId);
                return (
                  <div key={entry.id} className="flex items-start gap-2.5 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0d9488] mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#4b5563] leading-relaxed">
                        <span className="font-semibold text-[#1a1d23]">{actor?.name || 'System'}</span>
                        {' '}{entry.action}{' '}
                        <span className="font-semibold text-[#0d9488]">{entry.entityTitle}</span>
                      </p>
                      <p className="text-[10px] text-[#cbd5e1] mt-0.5">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showCreateUser && <CreateUserModal onClose={() => setShowCreateUser(false)} />}
      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}

      <ConfirmDialog
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (confirmCancel) {
            deactivateUser(confirmCancel.userId);
            toast.success(`Invitation cancelled for ${confirmCancel.userName}`);
          }
          setConfirmCancel(null);
        }}
        title="Cancel Invitation"
        message={`Are you sure you want to cancel the invitation for ${confirmCancel?.userName}? They will no longer be able to accept the invitation.`}
        confirmLabel="Cancel Invitation"
        danger
      />
    </div>
  );
};
