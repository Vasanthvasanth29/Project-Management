import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { Avatar } from '../../components/common/Avatar';
import { RoleBadge, PriorityBadge, StatusBadge } from '../../components/common/Badges';
import { ProgressBar } from '../../components/common/ProgressBar';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Users, Search, FolderKanban, AlertTriangle,
  X, BarChart3, MoreVertical, Eye, ClipboardList, ShieldAlert
} from 'lucide-react';
import { isOverdue, getDueDateLabel, getDueDateClass } from '../../utils/dateUtils';
import { getProjectUrl } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import type { Role, User } from '../../types';

const CAPACITY = 5;

type WorkloadLevel = 'Normal' | 'High' | 'Overloaded';

function getWorkloadLevel(activeCount: number): WorkloadLevel {
  if (activeCount > CAPACITY) return 'Overloaded';
  if (activeCount >= Math.ceil(CAPACITY * 0.6)) return 'High';
  return 'Normal';
}

function getWorkloadBarColor(level: WorkloadLevel): string {
  if (level === 'Overloaded') return '#ef4444';
  if (level === 'High') return '#f59e0b';
  return '#0d9488';
}

export const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { teams, users, tasks, projects } = useAppStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [workloadFilter, setWorkloadFilter] = useState<WorkloadLevel | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'overloaded' | 'has-overdue' | 'available'>('ALL');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // ADMIN bypasses team membership: every team member in the org is listed.
  const isAdmin = currentUser?.role === 'ADMIN';
  // ADMIN and PROJECT_MANAGER have organization-wide visibility of users/teams;
  // TEAM_LEADER stays scoped to its own team.
  const seeAllUsers = isAdmin || currentUser?.role === 'PROJECT_MANAGER';
  const myTeam = teams.find((t) => t.id === currentUser?.teamId);
  const teamMembers = seeAllUsers
    ? users
    : myTeam
    ? myTeam.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as typeof users
    : [];

  const memberData = useMemo(() => {
    return teamMembers.map((member) => {
      const memberTasks = tasks.filter((t) => t.assigneeId === member.id);
      const activeCount = memberTasks.filter((t) => t.status !== 'DONE').length;
      const doneCount = memberTasks.filter((t) => t.status === 'DONE').length;
      const overdueCount = memberTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate)).length;
      const blockedCount = memberTasks.filter((t) => t.status === 'BLOCKED').length;
      const workloadLevel = getWorkloadLevel(activeCount);
      const workloadPct = Math.min(100, Math.round((activeCount / CAPACITY) * 100));
      const assignedProjectIds = [...new Set(memberTasks.map((t) => t.projectId))];
      const assignedProjects = assignedProjectIds.map((pid) => projects.find((p) => p.id === pid)).filter(Boolean);
      const activeTasks = memberTasks.filter((t) => t.status !== 'DONE');
      const completedTasks = memberTasks.filter((t) => t.status === 'DONE');
      const overdueTasks = memberTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate));
      const blockedTasks = memberTasks.filter((t) => t.status === 'BLOCKED');
      return {
        member, memberTasks, activeCount, doneCount, overdueCount, blockedCount,
        workloadLevel, workloadPct, assignedProjects, assignedProjectIds,
        activeTasks, completedTasks, overdueTasks, blockedTasks,
      };
    });
  }, [teamMembers, tasks, projects]);

  const teamSummary = useMemo(() => {
    const totalMembers = memberData.length;
    const activeMembers = memberData.filter((m) => m.activeCount > 0).length;
    const totalOverdue = memberData.reduce((s, m) => s + m.overdueCount, 0);
    const totalBlocked = memberData.reduce((s, m) => s + m.blockedCount, 0);
    const totalActive = memberData.reduce((s, m) => s + m.activeCount, 0);
    const totalDone = memberData.reduce((s, m) => s + m.doneCount, 0);
    const totalTasks = totalActive + totalDone;
    const avgCompletion = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
    const teamWorkload = totalActive;
    return { totalMembers, activeMembers, totalOverdue, totalBlocked, totalActive, totalDone, avgCompletion, teamWorkload };
  }, [memberData]);

  const allProjectIds = useMemo(() => {
    const ids = new Set<string>();
    memberData.forEach((m) => m.assignedProjectIds.forEach((id) => ids.add(id)));
    return [...ids];
  }, [memberData]);

  const filteredMembers = useMemo(() => {
    return memberData.filter((m) => {
      if (search) {
        const q = search.toLowerCase();
        if (!m.member.name.toLowerCase().includes(q) && !m.member.email.toLowerCase().includes(q)) return false;
      }
      if (roleFilter !== 'ALL' && m.member.role !== roleFilter) return false;
      if (projectFilter !== 'ALL' && !m.assignedProjectIds.includes(projectFilter)) return false;
      if (workloadFilter !== 'ALL' && m.workloadLevel !== workloadFilter) return false;
      if (statusFilter === 'overloaded' && m.workloadLevel !== 'Overloaded') return false;
      if (statusFilter === 'has-overdue' && m.overdueCount === 0) return false;
      if (statusFilter === 'available' && m.workloadLevel !== 'Normal') return false;
      return true;
    });
  }, [memberData, search, roleFilter, projectFilter, workloadFilter, statusFilter]);

  const handleCountClick = (member: User, filterType: 'active' | 'done' | 'overdue' | 'blocked') => {
    switch (filterType) {
      case 'active': navigate(`/tl/tasks?assignee=${member.id}&status=active`); break;
      case 'done': navigate(`/tl/tasks?assignee=${member.id}&status=DONE`); break;
      case 'overdue': navigate(`/tl/tasks?assignee=${member.id}&overdue=true`); break;
      case 'blocked': navigate(`/tl/tasks?assignee=${member.id}&status=BLOCKED`); break;
    }
  };

  const hasActiveFilters = search || roleFilter !== 'ALL' || projectFilter !== 'ALL' || workloadFilter !== 'ALL' || statusFilter !== 'ALL';

  if (teamMembers.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="page-title">{seeAllUsers ? 'Teams' : myTeam?.name || 'My Team'}</h1>
          <p className="page-subtitle">0 active team members</p>
        </div>
        <div className="card">
          <EmptyState icon={Users} title="No Team Members" description={seeAllUsers ? "No users found in this organization yet." : myTeam ? "Your team doesn't have any members assigned yet." : "You don't have a team assigned."} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div>
        <h1 className="page-title">{seeAllUsers ? 'All Teams' : 'Development Team'}</h1>
        <p className="page-subtitle">
          {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
          {seeAllUsers ? ' across every team' : ''}
        </p>
      </div>

      {/* ── Summary Cards: 6 equal-width in one row ── */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { value: teamSummary.totalMembers, label: 'Total Members', color: '#0d9488', icon: Users },
          { value: teamSummary.activeMembers, label: 'Active Members', color: '#3b82f6', icon: ClipboardList },
          { value: teamSummary.totalOverdue, label: 'Overdue Tasks', color: '#ef4444', icon: AlertTriangle },
          { value: teamSummary.totalBlocked, label: 'Blocked Tasks', color: '#f59e0b', icon: ShieldAlert },
          { value: `${teamSummary.avgCompletion}%`, label: 'Avg Completion', color: '#10b981', icon: BarChart3 },
          { value: teamSummary.teamWorkload, label: 'Team Workload', color: '#6366f1', icon: Users },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: s.color + '12' }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div className="text-xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter Toolbar: ONE horizontal row ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] transition-all"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')} className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 appearance-none cursor-pointer min-w-[110px]">
          <option value="ALL">All Roles</option>
          <option value="TEAM_LEADER">Team Leader</option>
          <option value="MEMBER">Member</option>
          <option value="PROJECT_MANAGER">Project Manager</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 appearance-none cursor-pointer min-w-[120px]">
          <option value="ALL">All Projects</option>
          {allProjectIds.map((pid) => {
            const p = projects.find((pr) => pr.id === pid);
            return p ? <option key={pid} value={pid}>{p.name}</option> : null;
          })}
        </select>
        <select value={workloadFilter} onChange={(e) => setWorkloadFilter(e.target.value as WorkloadLevel | 'ALL')} className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 appearance-none cursor-pointer min-w-[120px]">
          <option value="ALL">All Workloads</option>
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Overloaded">Overloaded</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 appearance-none cursor-pointer min-w-[110px]">
          <option value="ALL">All Status</option>
          <option value="has-overdue">Has Overdue</option>
          <option value="overloaded">Overloaded</option>
          <option value="available">Available</option>
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setSearch(''); setRoleFilter('ALL'); setProjectFilter('ALL'); setWorkloadFilter('ALL'); setStatusFilter('ALL'); }} className="px-2.5 py-2 text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* ── Member Cards: 3-column grid ── */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Users} title="No members match filters" description="Try adjusting your search or filters." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map(({ member, activeCount, doneCount, overdueCount, blockedCount, workloadLevel, workloadPct, assignedProjects }) => {
            const barColor = getWorkloadBarColor(workloadLevel);
            const progressPct = (activeCount + doneCount) > 0 ? Math.round((doneCount / (activeCount + doneCount)) * 100) : 0;

            return (
              <div key={member.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 hover:border-[#0d9488]/30 hover:shadow-sm transition-all">
                {/* Top: Avatar + Info + Menu */}
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} color={member.avatarColor} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{member.name}</h3>
                    <p className="text-[11px] text-slate-400 truncate">{member.email}</p>
                    <div className="mt-1"><RoleBadge role={member.role} /></div>
                  </div>
                  <div className="relative">
                    <button onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === member.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-in fade-in">
                        <button onClick={() => { setSelectedMember(member); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                        <button onClick={() => { navigate(`/tl/tasks?assignee=${member.id}`); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                          <ClipboardList className="w-3.5 h-3.5" /> View Tasks
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <ProgressBar value={progressPct} height="sm" color={overdueCount > 0 ? '#ef4444' : '#0d9488'} />

                {/* Clickable Counts */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { count: activeCount, label: 'Active', color: '#0d9488', bg: '#f0fdfa', hoverBg: '#ccfbf1', filter: 'active' as const },
                    { count: doneCount, label: 'Done', color: '#10b981', bg: '#d1fae5', hoverBg: '#a7f3d0', filter: 'done' as const },
                    { count: overdueCount, label: 'Overdue', color: '#ef4444', bg: '#fef2f2', hoverBg: '#fecaca', filter: 'overdue' as const },
                    { count: blockedCount, label: 'Blocked', color: '#eab308', bg: '#fefce8', hoverBg: '#fef08a', filter: 'blocked' as const },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => handleCountClick(member, c.filter)}
                      className="text-center py-1.5 rounded-lg transition-colors cursor-pointer group"
                      style={{ backgroundColor: c.bg }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = c.hoverBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = c.bg; }}
                    >
                      <div className="text-sm font-bold font-display" style={{ color: c.color }}>{c.count}</div>
                      <div className="text-[9px] text-slate-400">{c.label}</div>
                    </button>
                  ))}
                </div>

                {/* Workload */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Workload</span>
                      <span className="text-[10px] font-bold" style={{ color: barColor }}>{activeCount}/{CAPACITY} &middot; {workloadLevel}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${workloadPct}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                </div>

                {/* Assigned Projects */}
                {assignedProjects.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" /> Projects
                    </div>
                    <div className="space-y-0.5">
                      {assignedProjects.slice(0, 2).map((p) => p && (
                        <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#0d9488] cursor-pointer" onClick={() => navigate(getProjectUrl(p, 'TEAM_LEADER'))}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.status === 'ACTIVE' ? '#10b981' : '#94a3b8' }} />
                          <span className="truncate">{p.name}</span>
                          <span className="text-[9px] text-slate-400 ml-auto">{p.progress}%</span>
                        </div>
                      ))}
                      {assignedProjects.length > 2 && <span className="text-[9px] text-slate-400">+{assignedProjects.length - 2} more</span>}
                    </div>
                  </div>
                )}

                {/* Overdue Warning */}
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-semibold p-1.5 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="w-3 h-3" />
                    {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''} requiring attention
                  </div>
                )}

                {/* View Details */}
                <button onClick={() => setSelectedMember(member)} className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-[#0d9488] hover:text-[#0f766e] hover:bg-[#f0fdfa] rounded-lg transition-colors">
                  <Eye className="w-3 h-3" /> View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Team Performance: BELOW member cards ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <BarChart3 className="w-4 h-4 text-[#0d9488]" />
          <h2 className="text-sm font-bold text-slate-800">Team Performance</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { value: teamSummary.totalDone, label: 'Completed', color: '#10b981', bg: '#ecfdf5' },
            { value: teamSummary.totalActive, label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
            { value: teamSummary.totalOverdue, label: 'Overdue', color: '#ef4444', bg: '#fef2f2' },
            { value: teamSummary.totalBlocked, label: 'Blocked', color: '#f59e0b', bg: '#fffbeb' },
            { value: `${teamSummary.avgCompletion}%`, label: 'Avg Completion', color: '#0d9488', bg: '#f0fdfa' },
            { value: teamSummary.teamWorkload, label: 'Team Workload', color: '#6366f1', bg: '#eef2ff' },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl text-center" style={{ backgroundColor: s.bg }}>
              <div className="text-xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Member Details Modal ── */}
      {selectedMember && (() => {
        const mData = memberData.find((m) => m.member.id === selectedMember.id);
        if (!mData) return null;
        const { member, activeTasks, completedTasks, overdueTasks, blockedTasks, assignedProjects, workloadLevel, workloadPct } = mData;
        const barColor = getWorkloadBarColor(workloadLevel);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-slate-200" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} color={member.avatarColor} size="lg" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{member.name}</h2>
                    <p className="text-xs text-slate-500">{member.email}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <RoleBadge role={member.role} />
                      {member.jobTitle && <span className="text-[10px] text-slate-400">{member.jobTitle}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: activeTasks.length, label: 'Active', color: '#0d9488', bg: '#f0fdfa' },
                    { value: completedTasks.length, label: 'Completed', color: '#10b981', bg: '#ecfdf5' },
                    { value: overdueTasks.length, label: 'Overdue', color: '#ef4444', bg: '#fef2f2' },
                    { value: blockedTasks.length, label: 'Blocked', color: '#eab308', bg: '#fefce8' },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl text-center" style={{ backgroundColor: s.bg }}>
                      <div className="text-xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Workload */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600">Workload</span>
                    <span className="text-xs font-bold" style={{ color: barColor }}>{workloadLevel} ({activeTasks.length}/{CAPACITY} tasks)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${workloadPct}%`, backgroundColor: barColor }} />
                  </div>
                </div>

                {/* Assigned Projects */}
                {assignedProjects.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 mb-2">Assigned Projects</h3>
                    <div className="flex flex-wrap gap-2">
                      {assignedProjects.map((p) => p && (
                        <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => { setSelectedMember(null); navigate(getProjectUrl(p, 'TEAM_LEADER')); }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.status === 'ACTIVE' ? '#10b981' : '#94a3b8' }} />
                          {p.name}
                          <span className="text-[9px] text-slate-400">{p.progress}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Tasks Table */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2">Assigned Tasks ({activeTasks.length + completedTasks.length})</h3>
                  {activeTasks.length + completedTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No tasks assigned</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                            <th className="px-3 py-2">Task</th>
                            <th className="px-3 py-2">Project</th>
                            <th className="px-3 py-2">Priority</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[11px]">
                          {[...activeTasks, ...completedTasks].slice(0, 10).map((task) => {
                            const proj = projects.find((p) => p.id === task.projectId);
                            return (
                              <tr key={task.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedMember(null); navigate(issuePath(task, '/tl/tasks')); }}>
                                <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[180px]">{task.title}</td>
                                <td className="px-3 py-2 text-slate-500">{proj?.name || '—'}</td>
                                <td className="px-3 py-2"><PriorityBadge priority={task.priority} /></td>
                                <td className="px-3 py-2"><StatusBadge status={task.status} resolution={task.resolution} /></td>
                                <td className={`px-3 py-2 ${getDueDateClass(task.dueDate)}`}>{getDueDateLabel(task.dueDate)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {(activeTasks.length + completedTasks.length) > 10 && (
                        <div className="px-3 py-2 text-center border-t border-slate-100">
                          <button onClick={() => { setSelectedMember(null); navigate(`/tl/tasks?assignee=${member.id}`); }} className="text-[10px] font-semibold text-[#0d9488] hover:text-[#0f766e]">
                            View all {activeTasks.length + completedTasks.length} tasks →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
