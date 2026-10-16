import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, Clock, AlertTriangle, Bug, ArrowRight, CalendarRange, CheckCircle, Sparkles, Plus
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { StatCard } from '../../components/common/StatCard';
import { BugIssueIcon } from '../../components/common/BugIssueIcon';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { EmptyState } from '../../components/common/EmptyState';
import { getDueDateLabel, getDueDateClass, isOverdue, isDueToday } from '../../utils/dateUtils';
import { issuePath } from '../../utils/issueUrl';
import { ResponsibilityChain } from '../../components/common/ResponsibilityChain';

export const MemberDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { tasks, bugs, projects, users, teams, workflows } = useAppStore();

  // ADMIN bypasses assignee scoping: every work item and bug is visible.
  const isAdmin = currentUser?.role === 'ADMIN';
  const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assigneeId === currentUser?.id);
  const activeTasks = myTasks.filter((t) => t.status !== 'DONE');
  const dueTodayTasks = myTasks.filter((t) => t.status !== 'DONE' && isDueToday(t.dueDate));
  const overdueTasks = myTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate));
  const inProgressTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS');
  const myBugs = isAdmin
    ? bugs.filter((b) => b.status !== 'CLOSED')
    : bugs.filter((b) => b.assignedToId === currentUser?.id && b.status !== 'CLOSED');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #115e59 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, #0d9488 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#2dd4bf] text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            Developer & Execution Hub
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display">
            {greeting()}, {currentUser?.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Here is your daily assigned workflow & action items
          </p>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Due Today" value={dueTodayTasks.length} icon={Clock} iconColor="#0d9488" iconBg="#ccfbf1" />
        <StatCard title="In Progress" value={inProgressTasks.length} icon={CheckSquare} iconColor="#06b6d4" iconBg="#cffafe" />
        <StatCard title="Overdue" value={overdueTasks.length} icon={AlertTriangle}
          iconColor={overdueTasks.length > 0 ? '#ef4444' : '#10b981'}
          iconBg={overdueTasks.length > 0 ? '#fee2e2' : '#d1fae5'}
          badge={overdueTasks.length > 0 ? 'Urgent' : undefined} badgeColor="badge-red" />
        <StatCard title="Assigned Bugs" value={myBugs.length} icon={Bug}
          iconColor={myBugs.length > 0 ? '#ef4444' : '#10b981'}
          iconBg={myBugs.length > 0 ? '#fee2e2' : '#d1fae5'} />
      </div>

      {/* Main Focus: My Tasks Today */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h2 className="section-title mb-0">Your Tasks Today</h2>
                <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e] flex items-center gap-1"
                  onClick={() => navigate('/member/tasks')}>
                  View all tasks
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {activeTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="You're all caught up!"
                description="No active tasks assigned. Great job!"
              />
            ) : (
              <div className="space-y-3">
                {activeTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  const leader = users.find((u) => u.id === task.teamLeaderId);

                  return (
                    <div key={task.id}
                      className="card p-4 hover:border-[#0d9488]/30 cursor-pointer group"
                      onClick={() => navigate(issuePath(task))}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-[#0d9488] mb-0.5 block">
                            {project?.name || 'Project'}
                          </span>
                          <h3 className="text-sm font-bold text-[#1a1d23] group-hover:text-[#0d9488] transition-colors">{task.title}</h3>
                        </div>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <p className="text-xs text-[#9ca3af] line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                      <div className="flex items-center justify-between pt-2.5 border-t border-[#f1f5f9] text-xs">
                        <span className={`px-2 py-0.5 rounded-lg font-medium text-[10px] ${getDueDateClass(task.dueDate)}`}>
                          {getDueDateLabel(task.dueDate)}
                        </span>
                        <div className="flex items-center gap-2">
                          {leader && <span className="text-[11px] text-[#9ca3af]">Assigned by {leader.name}</span>}
                          <StatusBadge status={task.status} resolution={task.resolution} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Responsibility & Bugs */}
        <div className="space-y-4">
          {activeTasks[0] && (
            <div className="card p-6">
              <h3 className="text-xs font-bold text-[#4b5563] uppercase tracking-wider mb-3">Primary Responsibility Hierarchy</h3>
              <ResponsibilityChain
                admin={users.find((u) => u.role === 'ADMIN')}
                projectManager={users.find((u) => u.id === projects.find((p) => p.id === activeTasks[0].projectId)?.projectManagerId)}
                team={teams.find((t) => t.id === activeTasks[0].teamId)}
                teamLeader={users.find((u) => u.id === activeTasks[0].teamLeaderId)}
                member={currentUser || undefined}
                taskTitle={activeTasks[0].title}
                compact
              />
            </div>
          )}

          {myBugs.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
                <h3 className="text-xs font-bold text-[#4b5563] uppercase tracking-wider">Assigned Bugs</h3>
                <span className="badge-red text-[10px]">{myBugs.length}</span>
              </div>
              <div className="space-y-2">
                {myBugs.slice(0, 4).map((bug) => (
                  <div key={bug.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                    <BugIssueIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1a1d23] truncate flex-1">{bug.title}</span>
                    <span className={`badge text-[9px] ${bug.severity === 'CRITICAL' ? 'badge-red' : bug.severity === 'HIGH' ? 'badge-orange' : 'badge-amber'}`}>
                      {bug.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
