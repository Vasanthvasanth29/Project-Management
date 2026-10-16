import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, CheckCircle, Bug,
  Plus, ArrowRight, CalendarRange, Sparkles,
  FolderKanban, ShieldAlert, Zap, Timer, CircleAlert,
  Eye, ChevronRight, CalendarClock, Shield, Siren, LayoutGrid,
  CircleDot, Flame, Bell
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { EmptyState } from '../../components/common/EmptyState';
import { getDueDateLabel, getDueDateClass, isOverdue, isDueToday, formatShortDate } from '../../utils/dateUtils';
import { getProjectUrl } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import { AssignTaskModal } from './AssignTaskModal';

export const TLDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { users, tasks, bugs, teams, sprints, projects, activities, notifications } = useAppStore();
  const [showAssign, setShowAssign] = useState(false);

  // ADMIN bypasses team / assignment scoping: it sees the whole organization.
  const isAdmin = currentUser?.role === 'ADMIN';

  const myTeam = teams.find((t) => t.id === currentUser?.teamId);
  const teamMembers = isAdmin
    ? ([
        ...new Set(teams.flatMap((t) => [...t.memberIds, ...(t.teamLeaderId ? [t.teamLeaderId] : [])])),
      ]
        .map((id) => users.find((u) => u.id === id))
        .filter(Boolean) as typeof users)
    : myTeam
    ? myTeam.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as typeof users
    : [];

  const myTasks = isAdmin ? tasks : tasks.filter((t) => t.teamLeaderId === currentUser?.id);

  // ── Core Metrics ──
  const activeTasks = myTasks.filter((t) => t.status !== 'DONE');
  const todoTasks = activeTasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = activeTasks.filter((t) => t.status === 'IN_PROGRESS');
  const inReviewTasks = activeTasks.filter((t) => t.status === 'IN_REVIEW');
  const blockedTasks = activeTasks.filter((t) => t.status === 'BLOCKED');
  const doneTodayTasks = myTasks.filter((t) => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).toDateString() === new Date().toDateString();
  });
  const overdueTasks = myTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate));
  const dueTodayTasks = myTasks.filter((t) => t.status !== 'DONE' && isDueToday(t.dueDate));

  // ── Bugs ──
  const openBugs = bugs.filter((b) => b.stageId && ['OPEN', 'IN_PROGRESS'].includes(b.status));
  const criticalBugs = openBugs.filter((b) => b.severity === 'CRITICAL');
  const highBugs = openBugs.filter((b) => b.severity === 'HIGH');
  const mediumBugs = openBugs.filter((b) => b.severity === 'MEDIUM');
  const lowBugs = openBugs.filter((b) => b.severity === 'LOW');

  // ── Iterations ──
  const mySprints = isAdmin ? sprints : sprints.filter((s) => s.teamLeaderId === currentUser?.id);
  const myProjects = isAdmin
    ? projects.filter((p) => !p.isArchived)
    : projects.filter((p) => mySprints.some((s) => s.projectId === p.id));
  const activeSprint = mySprints.find((s) => s.status === 'ACTIVE');
  const sprintTasks = activeSprint
    ? tasks.filter(
        (t) => t.sprintId === activeSprint.id && (isAdmin || t.teamLeaderId === currentUser?.id)
      )
    : [];
  const sprintDone = sprintTasks.filter((t) => t.status === 'DONE').length;
  const sprintProgress = sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
  const sprintOverdue = sprintTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate)).length;

  // ── Delivery Confidence ──
  const completionRate = myTasks.length > 0 ? myTasks.filter((t) => t.status === 'DONE').length / myTasks.length : 0;
  const riskPenalty = (overdueTasks.length * 0.05) + (criticalBugs.length * 0.08) + (blockedTasks.length * 0.06);
  const deliveryConfidence = Math.round(Math.max(0, Math.min(100, (completionRate * 100) - (riskPenalty * 100))));
  const confidenceLabel = deliveryConfidence >= 75 ? 'On Track' : deliveryConfidence >= 50 ? 'At Risk' : 'Critical';
  const confidenceColor = deliveryConfidence >= 75 ? '#10b981' : deliveryConfidence >= 50 ? '#f59e0b' : '#ef4444';

  // ── Delivery Risk Score ──
  const riskScore = (overdueTasks.length * 2) + (blockedTasks.length * 3) + (criticalBugs.length * 4);
  const riskLevel = riskScore >= 10 ? 'Critical' : riskScore >= 5 ? 'High' : riskScore >= 2 ? 'Medium' : 'Low';
  const riskColor = riskScore >= 10 ? '#ef4444' : riskScore >= 5 ? '#f97316' : riskScore >= 2 ? '#f59e0b' : '#10b981';

  // ── Pipeline Tasks (overdue first, then by priority) ──
  const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const pipelineTasks = [...myTasks]
    .sort((a, b) => {
      const aOverdue = a.status !== 'DONE' && isOverdue(a.dueDate) ? 0 : 1;
      const bOverdue = b.status !== 'DONE' && isOverdue(b.dueDate) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    })
    .slice(0, 8);

  // ── Team Capacity ──
  const totalCapacity = teamMembers.length * 5; // assume 5 tasks per member capacity
  const utilizedCapacity = teamMembers.reduce((sum, member) => {
    const memberActive = myTasks.filter((t) => t.assigneeId === member.id && t.status !== 'DONE').length;
    return sum + Math.min(memberActive, 5);
  }, 0);
  const capacityPct = totalCapacity > 0 ? Math.round((utilizedCapacity / totalCapacity) * 100) : 0;

  // ── Upcoming Deadlines ──
  const upcomingDeadlines = myTasks
    .filter((t) => t.status !== 'DONE' && t.dueDate && !isOverdue(t.dueDate))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  // ── Recent Notifications ──
  const myNotifications = notifications
    .filter((n) => n.userId === currentUser?.id && !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // ── Team Updates (recent activity) ──
  const teamActivity = activities
    .filter((a) => teamMembers.some((m) => m.id === a.userId) || a.projectId && myProjects.some((p) => p.id === a.projectId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: TEAM HEALTH SUMMARY (Header)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #0d9488 0%, transparent 50%)' }} />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#2dd4bf] text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              Engineering Team Leader Console
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display">
              {greeting()}, {currentUser?.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {myTeam?.name} · {teamMembers.length} engineer{teamMembers.length !== 1 ? 's' : ''} · {activeTasks.length} active work item{activeTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Delivery Confidence Score */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke={confidenceColor}
                    strokeWidth="3"
                    strokeDasharray={`${(deliveryConfidence / 100) * 97.4} 97.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{deliveryConfidence}</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-white/80">Delivery Confidence</div>
                <div className="text-sm font-bold" style={{ color: confidenceColor }}>{confidenceLabel}</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setShowAssign(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Assign Work</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: STAT CARDS — Active Tasks / Completed / Overdue / Bugs
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Tasks"
          value={activeTasks.length}
          icon={ClipboardList}
          iconColor="#0d9488"
          iconBg="#ccfbf1"
          onClick={() => navigate('/tl/tasks')}
        />
        <StatCard
          title="Completed Today"
          value={doneTodayTasks.length}
          icon={CheckCircle}
          iconColor="#10b981"
          iconBg="#d1fae5"
          trend={myTasks.length > 0 ? Math.round((doneTodayTasks.length / Math.max(myTasks.length, 1)) * 100) : 0}
          trendLabel="of total tasks"
        />
        <StatCard
          title="Overdue Work"
          value={overdueTasks.length}
          icon={AlertTriangle}
          iconColor={overdueTasks.length > 0 ? '#ef4444' : '#10b981'}
          iconBg={overdueTasks.length > 0 ? '#fee2e2' : '#d1fae5'}
          badge={overdueTasks.length > 0 ? 'Urgent' : undefined}
          badgeColor="badge-red"
          onClick={() => navigate('/tl/tasks')}
        />
        <StatCard
          title="Active Bugs"
          value={openBugs.length}
          icon={Bug}
          iconColor={openBugs.length > 0 ? '#ef4444' : '#10b981'}
          iconBg={openBugs.length > 0 ? '#fee2e2' : '#d1fae5'}
          onClick={() => navigate('/tl/bugs')}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: ACTIVE TASKS BREAKDOWN — Status counts with navigation
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'To Do', count: todoTasks.length, color: '#6b7280', icon: CircleDot },
          { label: 'In Progress', count: inProgressTasks.length, color: '#0d9488', icon: Timer },
          { label: 'In Review', count: inReviewTasks.length, color: '#6366f1', icon: Eye },
          { label: 'Blocked', count: blockedTasks.length, color: '#ef4444', icon: ShieldAlert },
          { label: 'Done Today', count: doneTodayTasks.length, color: '#10b981', icon: CheckCircle },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#f1f5f9] hover:border-[#0d9488]/30 hover:bg-[#f0fdfa] cursor-pointer transition-all group"
            onClick={() => navigate('/tl/tasks')}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '18' }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1a1d23] leading-tight">{s.count}</div>
              <div className="text-[10px] text-[#9ca3af] font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: TODAY'S FOCUS — Due today + priority items
      ═══════════════════════════════════════════════════════════════ */}
      {dueTodayTasks.length > 0 && (
        <div className="card p-5 border-l-4 border-l-[#f59e0b]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#f59e0b]" />
              <h2 className="section-title mb-0">Today's Focus</h2>
              <span className="badge-amber text-[10px]">{dueTodayTasks.length} due today</span>
            </div>
          </div>
          <div className="space-y-2">
            {dueTodayTasks.slice(0, 4).map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-[#fffbeb] border border-[#fef3c7] hover:bg-[#fef9e7] cursor-pointer transition-colors"
                  onClick={() => navigate(issuePath(task, '/tl/tasks'))}
                >
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs font-semibold text-[#1a1d23] truncate flex-1">{task.title}</span>
                  {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                  <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: MAIN GRID — Workload | Iteration+Delivery Risk | Bugs
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT (2 cols): Team Member Workload ── */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2">
              <h2 className="section-title mb-0">Team Member Workload</h2>
              <span className="badge-teal text-[10px]">{capacityPct}% capacity</span>
            </div>
            <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e]"
              onClick={() => navigate('/tl/team')}>
              View Full Team →
            </button>
          </div>
          <div className="space-y-3">
            {teamMembers.map((member) => {
              if (!member) return null;
              const memberTasks = myTasks.filter((t) => t.assigneeId === member.id);
              const doneMember = memberTasks.filter((t) => t.status === 'DONE').length;
              const inProgMember = memberTasks.filter((t) => t.status === 'IN_PROGRESS').length;
              const todoMember = memberTasks.filter((t) => t.status === 'TODO').length;
              const overdueMember = memberTasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueDate)).length;
              const activeMember = memberTasks.filter((t) => t.status !== 'DONE').length;
              const capacityState = activeMember >= 5 ? 'over' : activeMember >= 3 ? 'near' : 'under';
              const capacityLabel = capacityState === 'over' ? 'Overloaded' : capacityState === 'near' ? 'Near Capacity' : 'Available';
              const capacityColor = capacityState === 'over' ? '#ef4444' : capacityState === 'near' ? '#f59e0b' : '#10b981';

              return (
                <div key={member.id} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9] hover:border-[#0d9488]/20 transition-colors">
                  <Avatar name={member.name} color={member.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1a1d23]">{member.name}</span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: capacityColor + '18', color: capacityColor }}
                        >
                          {capacityLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {inProgMember > 0 && <span className="text-[#0d9488] font-semibold">{inProgMember} active</span>}
                        {todoMember > 0 && <span className="text-[#6b7280] font-semibold">{todoMember} queued</span>}
                        {doneMember > 0 && <span className="text-[#059669] font-semibold">{doneMember} done</span>}
                        {overdueMember > 0 && <span className="text-[#ef4444] font-bold">{overdueMember} overdue</span>}
                      </div>
                    </div>
                    <ProgressBar
                      value={memberTasks.length > 0 ? Math.round((doneMember / memberTasks.length) * 100) : 0}
                      height="sm"
                      color={overdueMember > 0 ? '#ef4444' : capacityColor}
                    />
                    <div className="text-[10px] text-[#9ca3af] mt-1">
                      {activeMember} active of {memberTasks.length} total
                    </div>
                  </div>
                  {/* Quick Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      className="p-1.5 rounded-lg hover:bg-[#ccfbf1] text-[#0d9488] transition-colors"
                      title={`Assign task to ${member.name}`}
                      onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-[#f0f9ff] text-[#6366f1] transition-colors"
                      title={`View ${member.name}'s tasks`}
                      onClick={() => navigate('/tl/tasks')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Iteration Health + Delivery Risk + Active Bugs ── */}
        <div className="space-y-4">
          {/* Iteration Health */}
          {activeSprint ? (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <h2 className="section-title mb-0">Iteration Health</h2>
                  {sprintOverdue > 0 && (
                    <span className="badge-red text-[10px]">
                      <Siren className="w-3 h-3 inline mr-0.5" /> {sprintOverdue} overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold text-[#1a1d23] font-display">{activeSprint.name}</div>
                  <span className="text-xs font-semibold text-[#0d9488]">{sprintProgress}%</span>
                </div>
                <p className="text-[11px] text-[#9ca3af] mb-2 leading-relaxed line-clamp-1">{activeSprint.goal}</p>
                <ProgressBar value={sprintProgress} color="#0d9488" />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#d1fae5] border border-[#a7f3d0]">
                  <div className="text-sm font-bold text-[#059669] font-display">{sprintDone}</div>
                  <div className="text-[9px] text-[#9ca3af]">Done</div>
                </div>
                <div className="p-2 rounded-lg bg-[#ccfbf1] border border-[#99f6e4]">
                  <div className="text-sm font-bold text-[#0d9488] font-display">
                    {sprintTasks.filter((t) => t.status === 'IN_PROGRESS').length}
                  </div>
                  <div className="text-[9px] text-[#9ca3af]">Active</div>
                </div>
                <div className="p-2 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0]">
                  <div className="text-sm font-bold text-[#4b5563] font-display">
                    {sprintTasks.filter((t) => t.status === 'TODO').length}
                  </div>
                  <div className="text-[9px] text-[#9ca3af]">To Do</div>
                </div>
                <div className="p-2 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                  <div className="text-sm font-bold text-[#ef4444] font-display">{sprintOverdue}</div>
                  <div className="text-[9px] text-[#9ca3af]">Overdue</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-[#9ca3af]">
                <span>{formatShortDate(activeSprint.startDate)} — {formatShortDate(activeSprint.endDate)}</span>
                <span>{sprintTasks.length - sprintDone} items remaining</span>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center">
              <CalendarRange className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[#9ca3af]">No Active Iteration</p>
              <p className="text-[10px] text-[#d1d5db] mt-1">Start an iteration to track progress</p>
            </div>
          )}

          {/* Delivery Risk */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: riskColor }} />
                <h2 className="section-title mb-0">Delivery Risk</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: riskColor + '18', color: riskColor }}>{riskLevel}</span>
            </div>
            <div className="space-y-2.5">
              {overdueTasks.length > 0 && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                  <AlertTriangle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d23]">{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-[#9ca3af]">Requires immediate attention</div>
                  </div>
                </div>
              )}
              {blockedTasks.length > 0 && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa]">
                  <ShieldAlert className="w-4 h-4 text-[#f97316] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d23]">{blockedTasks.length} blocked task{blockedTasks.length !== 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-[#9ca3af]">Dependencies or blockers</div>
                  </div>
                </div>
              )}
              {criticalBugs.length > 0 && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                  <Bug className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d23]">{criticalBugs.length} critical bug{criticalBugs.length !== 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-[#9ca3af]">Impact on delivery timeline</div>
                  </div>
                </div>
              )}
              {overdueTasks.length === 0 && blockedTasks.length === 0 && criticalBugs.length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle className="w-6 h-6 text-[#10b981] mx-auto mb-1" />
                  <p className="text-xs text-[#9ca3af]">No active delivery risks</p>
                </div>
              )}
            </div>
          </div>

          {/* Active Bugs Severity Breakdown */}
          {openBugs.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <h2 className="section-title mb-0">Active Bugs</h2>
                  <span className="badge-red text-[10px]">{openBugs.length}</span>
                </div>
                <button onClick={() => navigate('/tl/bugs')} className="text-xs text-[#0d9488] font-semibold">View all →</button>
              </div>
              <div className="space-y-2">
                {criticalBugs.length > 0 && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                    <Bug className="w-3.5 h-3.5 text-[#ef4444] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1a1d23] flex-1">Critical</span>
                    <span className="text-xs font-bold text-[#ef4444]">{criticalBugs.length}</span>
                  </div>
                )}
                {highBugs.length > 0 && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#fff7ed] border border-[#fed7aa]">
                    <Bug className="w-3.5 h-3.5 text-[#f97316] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1a1d23] flex-1">High</span>
                    <span className="text-xs font-bold text-[#f97316]">{highBugs.length}</span>
                  </div>
                )}
                {mediumBugs.length > 0 && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#fefce8] border border-[#fef08a]">
                    <Bug className="w-3.5 h-3.5 text-[#eab308] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1a1d23] flex-1">Medium</span>
                    <span className="text-xs font-bold text-[#eab308]">{mediumBugs.length}</span>
                  </div>
                )}
                {lowBugs.length > 0 && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0]">
                    <Bug className="w-3.5 h-3.5 text-[#22c55e] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1a1d23] flex-1">Low</span>
                    <span className="text-xs font-bold text-[#22c55e]">{lowBugs.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: BLOCKER CENTER + TEAM CAPACITY + UPCOMING DEADLINES
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blocker Center */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <CircleAlert className="w-4 h-4 text-[#ef4444]" />
            <h2 className="section-title mb-0">Blocker Center</h2>
          </div>
          {blockedTasks.length > 0 ? (
            <div className="space-y-2">
              {blockedTasks.slice(0, 4).map((task) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                return (
                  <div key={task.id} className="p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] cursor-pointer transition-colors" onClick={() => navigate(issuePath(task, '/tl/tasks'))}>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-3 h-3 text-[#ef4444]" />
                      <span className="text-xs font-semibold text-[#1a1d23] truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        {task.dueDate && <span className={`text-[10px] ${getDueDateClass(task.dueDate)}`}>{getDueDateLabel(task.dueDate)}</span>}
                      </div>
                      {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-[#10b981] mx-auto mb-2" />
              <p className="text-xs text-[#9ca3af]">No blocked tasks — all clear!</p>
            </div>
          )}
        </div>

        {/* Team Capacity Summary */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <LayoutGrid className="w-4 h-4 text-[#6366f1]" />
            <h2 className="section-title mb-0">Team Capacity</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9ca3af]">Utilization</span>
              <span className="text-sm font-bold text-[#1a1d23]">{capacityPct}%</span>
            </div>
            <ProgressBar value={capacityPct} color={capacityPct > 90 ? '#ef4444' : capacityPct > 70 ? '#f59e0b' : '#0d9488'} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-[#f0fdfa]">
                <div className="text-sm font-bold text-[#0d9488] font-display">{utilizedCapacity}</div>
                <div className="text-[9px] text-[#9ca3af]">In Use</div>
              </div>
              <div className="p-2 rounded-lg bg-[#f1f5f9]">
                <div className="text-sm font-bold text-[#4b5563] font-display">{totalCapacity - utilizedCapacity}</div>
                <div className="text-[9px] text-[#9ca3af]">Available</div>
              </div>
              <div className="p-2 rounded-lg bg-[#f0f9ff]">
                <div className="text-sm font-bold text-[#6366f1] font-display">{teamMembers.length}</div>
                <div className="text-[9px] text-[#9ca3af]">Members</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <CalendarClock className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="section-title mb-0">Upcoming Deadlines</h2>
          </div>
          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-2">
              {upcomingDeadlines.map((task) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                return (
                  <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#f8fafc] cursor-pointer transition-colors" onClick={() => navigate(issuePath(task, '/tl/tasks'))}>
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${isDueToday(task.dueDate) ? 'bg-[#f59e0b]' : 'bg-[#e2e8f0]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d23] truncate">{task.title}</div>
                      <div className={`text-[10px] ${getDueDateClass(task.dueDate)}`}>
                        {getDueDateLabel(task.dueDate)}
                      </div>
                    </div>
                    <PriorityBadge priority={task.priority} />
                    {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <CalendarRange className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
              <p className="text-xs text-[#9ca3af]">No upcoming deadlines</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7: TASK PIPELINE — with quick actions
      ═══════════════════════════════════════════════════════════════ */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
          <h2 className="section-title mb-0">Assigned Task Pipeline</h2>
          <button className="btn-secondary btn-sm" onClick={() => navigate('/tl/tasks')}>
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {pipelineTasks.length > 0 ? pipelineTasks.map((task) => {
            const assignee = users.find((u) => u.id === task.assigneeId);
            return (
              <div key={task.id} className={`flex items-center gap-4 p-3.5 rounded-xl border hover:bg-[#f8fafc] hover:border-[#0d9488]/20 transition-all group ${task.status !== 'DONE' && isOverdue(task.dueDate) ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#f1f5f9]'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#1a1d23] truncate group-hover:text-[#0d9488] transition-colors">{task.title}</div>
                  <div className={`text-[11px] mt-0.5 ${getDueDateClass(task.dueDate)}`}>
                    {getDueDateLabel(task.dueDate)}
                  </div>
                </div>
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} resolution={task.resolution} />
                {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                <button
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#f0fdfa] text-[#0d9488] transition-all"
                  title="View task"
                  onClick={() => navigate(issuePath(task, '/tl/tasks'))}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }) : (
            <div className="text-center py-6">
              <ClipboardList className="w-7 h-7 text-[#e2e8f0] mx-auto mb-1.5" />
              <p className="text-xs text-[#9ca3af]">No tasks assigned</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8: TEAM UPDATES + NOTIFICATIONS + MY PROJECTS
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Updates */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#0d9488]" />
              <h2 className="section-title mb-0">Team Updates</h2>
            </div>
            <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e]" onClick={() => navigate('/tl/activity')}>
              All Activity →
            </button>
          </div>
          {teamActivity.length > 0 ? (
            <div className="space-y-2.5">
              {teamActivity.map((act) => {
                const actor = users.find((u) => u.id === act.userId);
                return (
                  <div key={act.id} className="flex items-start gap-2.5">
                    {actor && <Avatar name={actor.name} color={actor.avatarColor} size="xs" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-[#1a1d23] leading-relaxed">
                        <span className="font-semibold">{actor?.name || 'Someone'}</span>{' '}
                        <span className="text-[#9ca3af]">{act.action.toLowerCase()}</span>{' '}
                        <span className="font-medium">{act.entityTitle}</span>
                      </div>
                      <div className="text-[10px] text-[#d1d5db] mt-0.5">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Zap className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
              <p className="text-xs text-[#9ca3af]">No recent team updates</p>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <Bell className="w-4 h-4 text-[#6366f1]" />
            <h2 className="section-title mb-0">Notifications</h2>
            {myNotifications.length > 0 && (
              <span className="badge-indigo text-[10px]">{myNotifications.length}</span>
            )}
          </div>
          {myNotifications.length > 0 ? (
            <div className="space-y-2">
              {myNotifications.map((notif) => {
                const notifColor = notif.type.includes('OVERDUE') || notif.type.includes('BUG')
                  ? '#ef4444'
                  : notif.type.includes('TASK_ASSIGNED') || notif.type.includes('SPRINT')
                    ? '#0d9488'
                    : '#6366f1';
                return (
                  <div key={notif.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#f8fafc] transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: notifColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-[#1a1d23] truncate">{notif.title}</div>
                      <div className="text-[10px] text-[#9ca3af] line-clamp-1">{notif.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-[#10b981] mx-auto mb-2" />
              <p className="text-xs text-[#9ca3af]">All caught up!</p>
            </div>
          )}
        </div>

        {/* My Projects */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#0d9488]" />
              <h2 className="section-title mb-0">My Projects</h2>
            </div>
            <button className="text-xs text-[#0d9488] font-bold hover:text-[#0f766e]"
              onClick={() => navigate('/tl/projects')}>
              View All →
            </button>
          </div>
          {myProjects.length > 0 ? (
            <div className="space-y-2.5">
              {myProjects.slice(0, 4).map((project) => {
                const projectSprintCount = mySprints.filter((s) => s.projectId === project.id).length;
                const projectActiveTasks = myTasks.filter((t) => t.projectId === project.id && t.status !== 'DONE').length;
                return (
                  <div key={project.id}
                    className="p-3 rounded-xl border border-[#f1f5f9] hover:border-[#0d9488]/30 hover:shadow-sm cursor-pointer transition-all group"
                    onClick={() => navigate(getProjectUrl(project, 'TEAM_LEADER'))}>
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="text-xs font-bold text-[#1a1d23] group-hover:text-[#0d9488] transition-colors truncate">{project.name}</h3>
                      <span className={`badge text-[10px] flex-shrink-0 ml-2 ${project.status === 'ACTIVE' ? 'badge-green' : 'badge-teal'}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#9ca3af] mb-2">
                      <span className="flex items-center gap-1">
                        <CalendarRange className="w-3 h-3" />
                        {projectSprintCount} iteration{projectSprintCount !== 1 ? 's' : ''}
                      </span>
                      <span>{projectActiveTasks} active</span>
                    </div>
                    <ProgressBar value={project.progress} height="sm" color="#0d9488" />
                    <div className="text-[10px] text-[#9ca3af] mt-1.5">{project.progress}% complete</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <FolderKanban className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
              <p className="text-xs text-[#9ca3af]">No projects assigned</p>
            </div>
          )}
        </div>
      </div>

      {showAssign && (
        <AssignTaskModal
          onClose={() => setShowAssign(false)}
          sprintMemberIds={activeSprint?.memberIds}
        />
      )}
    </div>
  );
};
