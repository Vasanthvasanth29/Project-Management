import React, { useMemo } from 'react';
import { X, Briefcase, FolderKanban, Mail, Hash, Clock, Shield } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Avatar } from '../../components/common/Avatar';
import { RoleBadge, UserStatusBadge } from '../../components/common/Badges';
import { getRoleLabel, getUserStatusLabel } from '../../utils/roleUtils';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import type { User, Project } from '../../types';

interface UserDetailModalProps {
  user: User;
  onClose: () => void;
}

interface ProjectInvolvement {
  project: Project;
  role: string;
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INVITATION_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose }) => {
  const { projects, tasks, teams } = useAppStore();

  const involvements = useMemo<ProjectInvolvement[]>(() => {
    const results: ProjectInvolvement[] = [];
    const seen = new Set<string>();

    projects
      .filter((p) => p.projectManagerId === user.id)
      .forEach((p) => { results.push({ project: p, role: 'Project Manager' }); seen.add(p.id); });

    const ledTeamIds = teams.filter((t) => t.teamLeaderId === user.id).map((t) => t.id);
    if (ledTeamIds.length) {
      projects
        .filter((p) => !seen.has(p.id) && p.teamIds.some((tid) => ledTeamIds.includes(tid)))
        .forEach((p) => { results.push({ project: p, role: 'Team Leader' }); seen.add(p.id); });
    }

    if (user.teamId) {
      projects
        .filter((p) => !seen.has(p.id) && p.teamIds.includes(user.teamId as string))
        .forEach((p) => { results.push({ project: p, role: 'Team Member' }); seen.add(p.id); });
    }

    const taskProjectIds = new Set(tasks.filter((t) => t.assigneeId === user.id).map((t) => t.projectId));
    projects
      .filter((p) => !seen.has(p.id) && taskProjectIds.has(p.id))
      .forEach((p) => { results.push({ project: p, role: 'Contributor' }); seen.add(p.id); });

    return results;
  }, [projects, tasks, teams, user.id, user.teamId]);

  const assignedTaskCount = (projectId: string) =>
    tasks.filter((t) => t.assigneeId === user.id && t.projectId === projectId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-modal animate-scale-in max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">User Details</h2>
          <button className="btn-ghost p-2" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Profile */}
          <div className="flex items-center gap-4">
            <Avatar name={user.name} color={user.avatarColor} size="xl" className="w-16 h-16 text-xl shadow-md" />
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                {user.email}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={user.role} />
                <UserStatusBadge status={user.status} />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Employee ID
              </div>
              <div className="text-sm font-medium text-slate-800 mt-1">{user.employeeId}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Job Title
              </div>
              <div className="text-sm font-medium text-slate-800 mt-1">{user.jobTitle || '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Active
              </div>
              <div className="text-sm font-medium text-slate-800 mt-1">
                {user.lastActiveAt ? formatDateTime(user.lastActiveAt) : 'Never'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Joined</div>
              <div className="text-sm font-medium text-slate-800 mt-1">{formatDate(user.createdAt)}</div>
            </div>
          </div>

          {/* Account Status */}
          <div className={`p-3 rounded-xl border ${statusStyles[user.status] || 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-semibold">{getUserStatusLabel(user.status)}</span>
            </div>
            <p className="text-xs mt-1 opacity-75">
              {user.status === 'ACTIVE' && 'Account is active and fully accessible.'}
              {user.status === 'INVITATION_PENDING' && 'Invitation sent. Awaiting acceptance.'}
              {user.status === 'INACTIVE' && 'Account is deactivated. User cannot log in.'}
            </p>
          </div>

          {/* Project Involvement */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5" />
              Project Involvement
            </div>
            {involvements.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                Not currently working on any project
              </div>
            ) : (
              <div className="space-y-2">
                {involvements.map(({ project, role }) => (
                  <div key={project.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{project.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {role === 'Contributor' ? `${assignedTaskCount(project.id)} task(s) assigned` : project.status.charAt(0) + project.status.slice(1).toLowerCase().replace('_', ' ')}
                      </div>
                    </div>
                    <span className="badge badge-blue text-[11px] flex-shrink-0">{role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
