import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, Calendar, CheckSquare, ArrowRight, User, Sparkles, Layers } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { toUrlId, getProjectUrl } from '../../utils/idUtils';

export const MemberProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { projects, users, workflows, tasks, teams } = useAppStore();
  const [search, setSearch] = useState('');

  // Member's assigned team
  const myTeam = teams.find((t) => t.id === currentUser?.teamId);

  // Projects where member has assigned tasks OR member's team is assigned to project.
  // ADMIN bypasses membership entirely and sees every project in the organization.
  const activeProjects = projects.filter((project) => !project.isArchived);
  const memberProjects = currentUser?.role === 'ADMIN'
    ? activeProjects
    : activeProjects.filter((project) => {
        const hasAssignedTasks = tasks.some(
          (t) => t.projectId === project.id && t.assigneeId === currentUser?.id
        );
        const isTeamAssigned = myTeam ? project.teamIds.includes(myTeam.id) : false;
        return hasAssignedTasks || isTeamAssigned;
      });

  const filtered = memberProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-[#e0e2ec]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#0b57d0] text-xs font-semibold mb-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-[#1a73e8]" />
            Active Assignments
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1f1f1f] tracking-tight font-display">
            My Assigned Projects
          </h1>
          <p className="text-xs text-[#747775] mt-0.5">
            {currentUser?.role === 'ADMIN'
              ? `${memberProjects.length} project${memberProjects.length !== 1 ? 's' : ''} in the organization`
              : `${memberProjects.length} active project${memberProjects.length !== 1 ? 's' : ''} in your portfolio`}
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747775] pointer-events-none" />
        <input
          type="text"
          placeholder="Search assigned projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10 bg-white"
        />
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#e0e2ec]">
          <EmptyState
            icon={FolderKanban}
            title="No projects assigned"
            description="You are currently not assigned to any active projects. Projects will appear here when tasks or team assignments are delegated to you."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {filtered.map((project) => {
            const workflow = workflows.find((w) => w.id === project.workflowId);
            const currentStage = workflow?.stages.find((s) => s.id === project.currentStageId);
            const pm = users.find((u) => u.id === project.projectManagerId);

            // Tasks assigned to current member in this project
            const myProjectTasks = tasks.filter(
              (t) => t.projectId === project.id && t.assigneeId === currentUser?.id
            );
            const myCompletedTasks = myProjectTasks.filter((t) => t.status === 'DONE');

            return (
              <div
                key={project.id}
                onClick={() => navigate(getProjectUrl(project, currentUser?.role || 'MEMBER'))}
                className="bg-white rounded-3xl p-6 border border-[#e0e2ec] shadow-2xs hover:shadow-md hover:border-[#1a73e8] transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Title + Status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-[#1f1f1f] group-hover:text-[#1a73e8] transition-colors font-display line-clamp-1">
                        {project.name}
                      </h3>
                      <p className="text-xs text-[#747775] line-clamp-2 mt-1 leading-relaxed">
                        {project.description}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                        project.status === 'ACTIVE'
                          ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                          : 'bg-[#e8f0fe] text-[#1a73e8] border border-[#c2e7ff]'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="my-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#747775] mb-1.5">
                      <span>Overall Progress</span>
                      <span className="text-[#1f1f1f] font-bold">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} height="md" color="#1a73e8" />
                  </div>

                  {/* Stage & Member Task Metric Pills */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-[#f8fafd] border border-[#e0e2ec]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] mb-1">
                        Current Stage
                      </div>
                      <div className="text-xs font-bold text-[#1f1f1f] truncate">
                        {currentStage ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: currentStage.color }}
                            />
                            <span className="truncate">{currentStage.name}</span>
                          </span>
                        ) : (
                          'In Progress'
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#e8f0fe] border border-[#c2e7ff]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#0b57d0] mb-1">
                        Your Tasks
                      </div>
                      <div className="text-xs font-bold text-[#1a73e8] flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>
                          {myCompletedTasks.length}/{myProjectTasks.length} done
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: PM info + Target Date + Workspace Link */}
                <div className="pt-3 border-t border-[#f1f3f4] flex items-center justify-between gap-2 text-xs text-[#747775]">
                  {pm ? (
                    <div className="flex items-center gap-1.5 min-w-0" title={`Project Manager: ${pm.name}`}>
                      <Avatar name={pm.name} color={pm.avatarColor} size="xs" />
                      <span className="truncate text-[#444746] font-medium max-w-[120px]">
                        PM: {pm.name.split(' ')[0]}
                      </span>
                    </div>
                  ) : (
                    <span>Target: {formatDate(project.targetDate)}</span>
                  )}

                  <div className="flex items-center gap-1 font-bold text-[#1a73e8] group-hover:text-[#0b57d0] transition-colors">
                    <span>Open Project</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
