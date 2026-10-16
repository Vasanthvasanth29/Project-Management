import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, GitBranch, CalendarRange, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Plus, Sparkles,
  Target, BarChart3, Layers, Zap, Link2, Users, Package, Shield
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { StatCard } from '../../components/common/StatCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { SprintStatusBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ActivityFeed } from '../../components/common/ActivityFeed';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { toUrlId, getProjectUrl } from '../../utils/idUtils';

export const PMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { projects, sprints, tasks, workflows, users, activities, scenarios } = useAppStore();

  // ADMIN bypasses "managed by me" scoping and sees every project in the org.
  // Archived projects are excluded until restored.
  const visibleProjects = projects.filter((p) => !p.isArchived);
  const myProjects = currentUser?.role === 'ADMIN'
    ? visibleProjects
    : visibleProjects.filter((p) => p.projectManagerId === currentUser?.id);
  const activeSprints = sprints.filter((s) => {
    const sp = myProjects.find((p) => p.id === s.projectId);
    return sp && s.status === 'ACTIVE';
  });

  const myTasks = tasks.filter((t) => myProjects.some((p) => p.id === t.projectId));
  const overdueTasks = myTasks.filter((t) => {
    if (!t.dueDate || t.status === 'DONE') return false;
    return new Date(t.dueDate) < new Date();
  });
  const inProgressTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS');
  const blockedTasks = myTasks.filter((t) => t.status === 'BLOCKED');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #0d9488 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#2dd4bf] text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            Project Management Portal
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display">
            {greeting()}, {currentUser?.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Managing {myProjects.length} project{myProjects.length !== 1 ? 's' : ''} · {activeSprints.length} live iteration{activeSprints.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={currentUser?.role === 'ADMIN' ? 'All Projects' : 'My Projects'} value={myProjects.length} icon={FolderKanban} iconColor="#0d9488" iconBg="#ccfbf1" />
        <StatCard title="Live Iterations" value={activeSprints.length} icon={CalendarRange} iconColor="#06b6d4" iconBg="#cffafe" />
        <StatCard
          title="Overdue Tasks"
          value={overdueTasks.length}
          icon={AlertTriangle}
          iconColor={overdueTasks.length > 0 ? '#ef4444' : '#10b981'}
          iconBg={overdueTasks.length > 0 ? '#fee2e2' : '#d1fae5'}
          badge={overdueTasks.length > 0 ? 'Urgent' : undefined}
          badgeColor="badge-red"
        />
        <StatCard
          title="Blocked Tasks"
          value={blockedTasks.length}
          icon={Clock}
          iconColor={blockedTasks.length > 0 ? '#f59e0b' : '#10b981'}
          iconBg={blockedTasks.length > 0 ? '#fef3c7' : '#d1fae5'}
        />
      </div>

      {/* Projects */}
      <div>
        <h2 className="section-title">Assigned Projects</h2>
        {myProjects.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              icon={FolderKanban}
              title="No projects assigned"
              description="The Admin will assign you to projects once they are created."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myProjects.map((project) => {
              const workflow = workflows.find((w) => w.id === project.workflowId);
              const currentStage = workflow?.stages.find((s) => s.id === project.currentStageId);
              const projectSprints = sprints.filter((s) => s.projectId === project.id && s.status === 'ACTIVE');
              const projectTasks = tasks.filter((t) => t.projectId === project.id);
              const doneTasks = projectTasks.filter((t) => t.status === 'DONE').length;

              return (
                <div key={project.id} className="card p-6 group hover:border-[#0d9488]/30 transition-all cursor-pointer"
                  onClick={() => navigate(getProjectUrl(project, currentUser?.role))}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-[#1a1d23] mb-1 truncate font-display group-hover:text-[#0d9488] transition-colors">{project.name}</h3>
                      <p className="text-xs text-[#9ca3af] line-clamp-2 leading-relaxed">{project.description}</p>
                    </div>
                    <span className={`badge ml-3 flex-shrink-0 ${project.status === 'ACTIVE' ? 'badge-green' : 'badge-teal'} text-[11px]`}>
                      {project.status}
                    </span>
                  </div>

                  <ProgressBar value={project.progress} height="md" color="#0d9488" showLabel className="mb-4" />

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Current Stage</div>
                      <div className="text-xs font-bold text-[#1a1d23]">
                        {currentStage ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                            {currentStage.name}
                          </span>
                        ) : 'Not started'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Task Velocity</div>
                      <div className="text-xs font-bold text-[#1a1d23]">
                        {doneTasks}/{projectTasks.length} completed
                      </div>
                    </div>
                  </div>

                  {projectSprints.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1]">
                      <div className="flex items-center gap-2 text-xs text-[#0f766e]">
                        <CalendarRange className="w-3.5 h-3.5 text-[#0d9488]" />
                        <span className="font-bold">{projectSprints[0].name}</span>
                        <span className="text-[#5eead4]">·</span>
                        <span>Active · Ends {formatDate(projectSprints[0].endDate)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-[#f1f5f9]">
                    <span className="text-xs text-[#9ca3af]">Target: {formatDate(project.targetDate)}</span>
                    <button className="btn-primary btn-sm" onClick={() => navigate(getProjectUrl(project, currentUser?.role))}>
                      <span>Open Project</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Iterations */}
      {activeSprints.length > 0 && (
        <div>
          <h2 className="section-title">Live Iteration Runs</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
              const done = sprintTasks.filter((t) => t.status === 'DONE').length;
              const inProg = sprintTasks.filter((t) => t.status === 'IN_PROGRESS').length;
              const progress = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : 0;

              return (
                <div key={sprint.id} className="card p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#1a1d23] font-display">{sprint.name}</h3>
                      <p className="text-xs text-[#9ca3af] mt-0.5">{sprint.goal}</p>
                    </div>
                    <SprintStatusBadge status={sprint.status} />
                  </div>
                  <ProgressBar value={progress} color="#0d9488" showLabel className="mb-3" />
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[#059669] font-bold">{done} done</span>
                    <span className="text-[#0d9488] font-bold">{inProg} in progress</span>
                    <span className="text-[#9ca3af]">{sprintTasks.length - done - inProg} remaining</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#9ca3af]">
                    {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Deadlines & Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Deadlines */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Target className="w-4 h-4 text-[#0d9488]" />
            Upcoming Deadlines
          </h2>
          {(() => {
            const upcomingTasks = myTasks
              .filter((t) => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) > new Date())
              .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
              .slice(0, 5);

            if (upcomingTasks.length === 0) {
              return (
                <div className="text-center py-6 text-[#9ca3af]">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#10b981] opacity-40" />
                  <p className="text-xs">No upcoming deadlines</p>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {upcomingTasks.map((task) => {
                  const daysUntilDue = Math.ceil(
                    (new Date(task.dueDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isUrgent = daysUntilDue <= 2;

                  return (
                    <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${isUrgent ? 'bg-[#fef2f2] border border-[#fecaca]' : 'bg-[#f8fafc] border border-[#f1f5f9]'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUrgent ? 'bg-[#fee2e2]' : 'bg-[#ccfbf1]'}`}>
                        <CalendarRange className={`w-4 h-4 ${isUrgent ? 'text-[#ef4444]' : 'text-[#0d9488]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#1a1d23] truncate">{task.title}</div>
                        <div className="text-[10px] text-[#9ca3af]">
                          Due {formatDate(task.dueDate!)} · {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''} left
                        </div>
                      </div>
                      {isUrgent && (
                        <span className="text-[10px] font-bold text-[#ef4444] bg-[#fee2e2] px-2 py-0.5 rounded-lg">Urgent</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Velocity Trend */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0d9488]" />
            Iteration Velocity
          </h2>
          {(() => {
            const completedSprints = sprints
              .filter((s) => {
                const project = myProjects.find((p) => p.id === s.projectId);
                return project && s.status === 'COMPLETED';
              })
              .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
              .slice(-4);

            if (completedSprints.length === 0) {
              return (
                <div className="text-center py-6 text-[#9ca3af]">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No completed iterations yet</p>
                  <p className="text-[10px] mt-1">Complete iterations to see velocity trends</p>
                </div>
              );
            }

            const velocityData = completedSprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
              const completed = sprintTasks.filter((t) => t.status === 'DONE').length;
              return {
                name: sprint.name,
                planned: sprintTasks.length,
                completed,
              };
            });

            const maxTasks = Math.max(...velocityData.map((v) => Math.max(v.planned, v.completed)), 1);
            const avgVelocity = Math.round(
              velocityData.reduce((sum, v) => sum + v.completed, 0) / velocityData.length
            );

            return (
              <div>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-[#1a1d23]">{avgVelocity}</div>
                  <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Avg Tasks/Iteration</div>
                </div>
                <div className="space-y-3">
                  {velocityData.map((v, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-[#9ca3af] w-16 truncate font-medium">{v.name}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="h-5 bg-[#f1f5f9] rounded-lg flex-1 relative overflow-hidden">
                          <div
                            className="h-5 bg-[#e2e8f0] rounded-lg absolute top-0 left-0"
                            style={{ width: `${(v.planned / maxTasks) * 100}%` }}
                          />
                          <div
                            className="h-5 rounded-lg absolute top-0 left-0"
                            style={{ width: `${(v.completed / maxTasks) * 100}%`, background: 'linear-gradient(90deg, #0d9488, #06b6d4)' }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#1a1d23] w-8 text-right">{v.completed}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-[#9ca3af]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-2 rounded bg-[#e2e8f0]" />
                    <span>Planned</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-2 rounded" style={{ background: 'linear-gradient(90deg, #0d9488, #06b6d4)' }} />
                    <span>Completed</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Scenario Planning */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
          <h2 className="section-title flex items-center gap-2 mb-0">
            <Layers className="w-4 h-4 text-[#8b5cf6]" />
            Scenario Planning
          </h2>
          <span className="text-[10px] text-[#9ca3af] font-semibold">{scenarios.length} scenarios</span>
        </div>
        {scenarios.length === 0 ? (
          <div className="text-center py-6">
            <Layers className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
            <p className="text-xs text-[#9ca3af]">No scenarios created yet</p>
            <p className="text-[10px] text-[#cbd5e1] mt-1">Create scenarios from the Reports page to plan changes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenarios.slice(0, 3).map((scenario) => {
              const project = projects.find((p) => p.id === scenario.projectId);
              return (
                <div key={scenario.id} className="flex items-center justify-between p-3 rounded-xl bg-[#faf5ff] border border-[#e9d5ff]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f3e8ff] flex items-center justify-center">
                      <Zap className="w-4 h-4 text-[#9333ea]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#7e22ce]">{scenario.name}</div>
                      <div className="text-[10px] text-[#a855f7]">{project?.name} · {scenario.changes.length} changes</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#c084fc] font-medium">{formatDate(scenario.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Project Health */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#10b981]" />
            Project Health
          </h2>
          <div className="space-y-2">
            {myProjects.slice(0, 4).map((project) => {
              const projectTasks = tasks.filter((t) => t.projectId === project.id);
              const done = projectTasks.filter((t) => t.status === 'DONE').length;
              const blocked = projectTasks.filter((t) => t.status === 'BLOCKED').length;
              const overdue = projectTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
              const health = blocked > 0 ? 'critical' : overdue > 0 ? 'warning' : project.progress >= 50 ? 'good' : 'fair';
              const healthColor = {
                critical: 'text-[#dc2626] bg-[#fee2e2] border border-[#fecaca]',
                warning: 'text-[#d97706] bg-[#fef3c7] border border-[#fde68a]',
                good: 'text-[#059669] bg-[#d1fae5] border border-[#a7f3d0]',
                fair: 'text-[#0d9488] bg-[#ccfbf1] border border-[#99f6e4]'
              }[health];
              return (
                <div key={project.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                  <span className="text-xs font-semibold text-[#1a1d23] truncate">{project.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${healthColor}`}>{health}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Capacity */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Users className="w-4 h-4 text-[#06b6d4]" />
            Team Capacity
          </h2>
          <div className="space-y-2">
            {(() => {
              const activeTeamTasks = tasks.filter((t) => t.status !== 'DONE' && t.teamId && myProjects.some((p) => p.id === t.projectId));
              const teamMap = new Map<string, { name: string; tasks: number; points: number }>();
              activeTeamTasks.forEach((t) => {
                const team = useAppStore.getState().teams.find((tm) => tm.id === t.teamId);
                if (!team) return;
                const existing = teamMap.get(t.teamId!) || { name: team.name, tasks: 0, points: 0 };
                existing.tasks += 1;
                existing.points += t.storyPoints || 0;
                teamMap.set(t.teamId!, existing);
              });
              return Array.from(teamMap.values()).slice(0, 4).map((tm, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                  <span className="text-xs font-semibold text-[#1a1d23]">{tm.name}</span>
                  <span className="text-[10px] text-[#9ca3af] font-medium">{tm.tasks} tasks · {tm.points} pts</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Dependency Risks */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#ef4444]" />
            Dependency Risks
          </h2>
          {(() => {
            const projectTaskIds = new Set(myTasks.map((t) => t.id));
            const deps = useAppStore.getState().taskDependencies.filter((d) => projectTaskIds.has(d.taskId) || projectTaskIds.has(d.dependsOnTaskId));
            const blockedDeps = deps.filter((d) => {
              const from = tasks.find((t) => t.id === d.taskId);
              const to = tasks.find((t) => t.id === d.dependsOnTaskId);
              return (d.type === 'BLOCKED_BY' && to?.status === 'BLOCKED') || (d.type === 'BLOCKS' && from?.status === 'BLOCKED');
            });
            const crossTeam = deps.filter((d) => {
              const from = tasks.find((t) => t.id === d.taskId);
              const to = tasks.find((t) => t.id === d.dependsOnTaskId);
              return from?.teamId && to?.teamId && from.teamId !== to.teamId;
            });
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
                  <span className="text-xs font-semibold text-[#b91c1c]">Blocked Dependencies</span>
                  <span className="text-xs font-bold text-[#dc2626]">{blockedDeps.length}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf5ff] border border-[#e9d5ff]">
                  <span className="text-xs font-semibold text-[#7e22ce]">Cross-Team Dependencies</span>
                  <span className="text-xs font-bold text-[#9333ea]">{crossTeam.length}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                  <span className="text-xs font-semibold text-[#1a1d23]">Total Dependencies</span>
                  <span className="text-xs font-bold text-[#4b5563]">{deps.length}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Release Progress */}
      {(() => {
        const projectReleases = useAppStore.getState().releases.filter((r) => myProjects.some((p) => p.id === r.projectId));
        if (projectReleases.length === 0) return null;
        return (
          <div className="card p-6">
            <h2 className="section-title flex items-center gap-2">
              <Package className="w-4 h-4 text-[#8b5cf6]" />
              Release Progress
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {projectReleases.slice(0, 3).map((release) => (
                <div key={release.id} className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1a1d23]">{release.name}</span>
                    <span className={`badge text-[10px] ${release.status === 'IN_PROGRESS' ? 'badge-teal' : release.status === 'RELEASED' ? 'badge-green' : 'badge-gray'}`}>{release.status}</span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] rounded-full h-1.5 mb-1 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${release.progress}%`, background: 'linear-gradient(90deg, #8b5cf6, #a855f7)' }} />
                  </div>
                  <div className="text-[10px] text-[#9ca3af] font-medium">{release.progress}% · v{release.version}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/pm/roadmap')}
              className="mt-4 w-full text-center text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] flex items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-[#f0fdfa] transition-colors border border-[#ccfbf1]"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Open Cross-Project Roadmap
            </button>
          </div>
        );
      })()}

      {/* Activity */}
      <div className="card p-6">
        <h2 className="section-title mb-3">Project Stream Activity</h2>
        <ActivityFeed
          activities={activities.filter((a) =>
            myProjects.some((p) => p.id === a.entityId || tasks.find((t) => t.id === a.entityId && t.projectId === p.id))
          )}
          limit={8}
        />
      </div>
    </div>
  );
};
