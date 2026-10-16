import React, { useMemo, useState } from 'react';
import { ShieldCheck, Check, Minus, Users, FolderKanban, ListTodo, Zap, ChevronDown, Lock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { RoleBadge } from '../../components/common/Badges';
import {
  isAdmin,
  canManageUsers,
  canCreateUsers,
  canCreateProjects,
  canManageProjectSettings,
  canManageProjectMembers,
  canManageProjectRoles,
  canArchiveProjects,
  canViewAllProjects,
  canViewAllTeams,
  canViewAllUsers,
  canViewAllReports,
  canViewAuditLogs,
  canManageOrganization,
  canAccessAnyProject,
  canAssignTasks,
  canManageSprint,
} from '../../utils/roleUtils';
import type { Role } from '../../types';

const ROLES: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER'];

interface CapabilityRow {
  id: string;
  label: string;
  check: (role: Role) => boolean;
}

interface CapabilityGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  note: string;
  rows: CapabilityRow[];
}

// Access scope per role: ADMIN is unrestricted, every other role is bounded by
// project membership, team membership or assigned work.
const ROLE_META: Record<Role, { scope: string; blurb: string }> = {
  ADMIN: { scope: 'UNRESTRICTED', blurb: 'Unrestricted full access' },
  PROJECT_MANAGER: { scope: 'PROJECT SCOPED', blurb: 'Project-scoped access' },
  TEAM_LEADER: { scope: 'TEAM / PROJECT SCOPED', blurb: 'Team/project-scoped access' },
  MEMBER: { scope: 'ASSIGNED WORK SCOPED', blurb: 'Assigned-work access' },
};

// Rows marked `() => true` are capabilities the application does not gate by
// role: every role has them inside its own scope (admin = every scope). Rows
// backed by a roleUtils helper reflect the live permission model.
const GROUPS: CapabilityGroup[] = [
  {
    id: 'system',
    title: 'System',
    icon: ShieldCheck,
    note: 'Admin-only system pages · user management follows the role hierarchy (Admin → all, PM → TL & Members, TL → Members)',
    rows: [
      { id: 'sys-dashboard', label: 'System Dashboard', check: (r) => isAdmin(r) },
      { id: 'sys-users', label: 'User Management', check: canManageUsers },
      { id: 'sys-roles', label: 'Role & Permission Management', check: (r) => isAdmin(r) },
      { id: 'sys-settings', label: 'System Settings', check: (r) => isAdmin(r) },
      { id: 'sys-org', label: 'Organization Configuration', check: canManageOrganization },
      { id: 'sys-audit', label: 'Organization-wide Activity / Audit Logs', check: canViewAuditLogs },
    ],
  },
  {
    id: 'organization',
    title: 'Organization',
    icon: Users,
    note: 'All roles can view projects, teams & users · Organization Settings and Reporting are Admin-only · Access Any Project: Admin & PM',
    rows: [
      { id: 'org-projects', label: 'View All Projects', check: canViewAllProjects },
      { id: 'org-teams', label: 'View All Teams', check: canViewAllTeams },
      { id: 'org-users', label: 'View All Users', check: canViewAllUsers },
      { id: 'org-settings', label: 'Organization Settings', check: canManageOrganization },
      { id: 'org-open', label: 'Access Any Project', check: canAccessAnyProject },
      { id: 'org-reporting', label: 'Organization-level Reporting', check: canViewAllReports },
    ],
  },
  {
    id: 'project',
    title: 'Project',
    icon: FolderKanban,
    note: 'Admin & PM: create, edit and archive every project · TL: manage members & roles in its teams · Member: read-only',
    rows: [
      { id: 'prj-view', label: 'View Project', check: () => true },
      { id: 'prj-create', label: 'Create Project', check: canCreateProjects },
      { id: 'prj-edit', label: 'Edit Project', check: canManageProjectSettings },
      { id: 'prj-archive', label: 'Archive / Restore Project', check: canArchiveProjects },
      { id: 'prj-settings', label: 'Project Settings', check: canManageProjectSettings },
      { id: 'prj-members', label: 'Manage Project Members', check: canManageProjectMembers },
      { id: 'prj-roles', label: 'Manage Project Roles', check: canManageProjectRoles },
      { id: 'prj-work-items', label: 'Project Work Items', check: () => true },
      { id: 'prj-iterations', label: 'Project Iterations', check: () => true },
      { id: 'prj-roadmap', label: 'Project Roadmap', check: () => true },
      { id: 'prj-reports', label: 'Project Reports', check: () => true },
      { id: 'prj-health', label: 'Project Health & Risks', check: () => true },
      { id: 'prj-activity', label: 'Project Activity', check: () => true },
    ],
  },
  {
    id: 'work',
    title: 'Work Management',
    icon: ListTodo,
    note: 'Admin: any work item · other roles keep their existing scope',
    rows: [
      { id: 'wi-create', label: 'Create Work Item', check: () => true },
      { id: 'wi-edit', label: 'Edit Work Item', check: () => true },
      { id: 'wi-delete', label: 'Delete Work Item', check: () => true },
      { id: 'wi-assign', label: 'Assign / Reassign Work', check: canAssignTasks },
      { id: 'wi-priority', label: 'Change Priority', check: () => true },
      { id: 'wi-status', label: 'Change Status', check: () => true },
      { id: 'wi-tags', label: 'Manage Labels / Tags', check: () => true },
      { id: 'wi-deps', label: 'Manage Dependencies', check: () => true },
      { id: 'wi-iterations', label: 'Manage Iterations', check: canManageSprint },
      { id: 'wi-bugs', label: 'Manage Bugs', check: () => true },
      { id: 'wi-queue', label: 'View Work Queue', check: () => true },
    ],
  },
];

// Admin Actions are administrative operations performed from the admin area.
// The section reports the Admin state only, so other roles are not implied.
const ADMIN_ACTIONS: CapabilityRow[] = [
  { id: 'act-user-create', label: 'Create User', check: canCreateUsers },
  { id: 'act-user-edit', label: 'Edit User', check: canManageUsers },
  { id: 'act-user-status', label: 'Activate / Deactivate User', check: canManageUsers },
  { id: 'act-user-invite', label: 'Invite User', check: canCreateUsers },
  { id: 'act-user-role', label: 'Change User Role', check: canManageUsers },
  { id: 'act-project', label: 'Create / Edit / Archive Project', check: canCreateProjects },
  { id: 'act-teams', label: 'Manage Teams', check: (r) => isAdmin(r) },
  { id: 'act-permissions', label: 'Manage Permissions', check: (r) => isAdmin(r) },
  { id: 'act-audit', label: 'View Audit Logs', check: canViewAuditLogs },
];

// Flattened matrix used for the dynamic per-role permission counts.
const MATRIX_ROWS: CapabilityRow[] = GROUPS.flatMap((g) => g.rows);

const countGranted = (rows: CapabilityRow[], role: Role): number =>
  rows.filter((row) => row.check(role)).length;

const DEFAULT_OPEN: Record<string, boolean> = {
  system: true,
  organization: true,
  project: true,
  work: false,
  actions: false,
};

export const RolesPermissionsPage: React.FC = () => {
  const { users } = useAppStore();
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = { ADMIN: 0, PROJECT_MANAGER: 0, TEAM_LEADER: 0, MEMBER: 0 };
    users.forEach((u) => {
      if (counts[u.role] !== undefined) counts[u.role] += 1;
    });
    return counts;
  }, [users]);

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1 · Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">Manage access and capabilities across the FlowExec organization.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d9488]/10 border border-[#0d9488]/25">
          <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
          <span className="text-xs font-bold text-[#0d9488]">ADMIN = Full Access</span>
        </div>
      </div>

      {/* 2 · Role summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ROLES.map((role) => {
          const meta = ROLE_META[role];
          const isAdminRole = isAdmin(role);
          const count = roleCounts[role];
          return (
            <div
              key={role}
              className={`card p-4 flex flex-col gap-2.5 ${isAdminRole ? 'ring-1 ring-[#0d9488]/25' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <RoleBadge role={role} />
                <span className="text-lg font-bold font-display text-slate-900 leading-none">
                  {count}
                  <span className="text-[11px] font-medium text-slate-400 ml-1">
                    user{count !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>
              <span
                className={
                  isAdminRole
                    ? 'self-start px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-[#0d9488] text-white'
                    : 'self-start px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-slate-100 text-slate-500 border border-slate-200'
                }
              >
                {meta.scope}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{meta.blurb}</p>
              <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Permissions granted</span>
                <span className="font-bold text-slate-700">
                  {countGranted(MATRIX_ROWS, role)} / {MATRIX_ROWS.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3 · Permission matrix */}
      <div className="card overflow-hidden">
        {/* 5 · Admin full-access indicator */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start gap-3 flex-wrap justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-[#0d9488]/10 border border-[#0d9488]/20 text-[#0d9488] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-[#0d9488] text-white">
                  ADMIN
                </span>
                <h2 className="text-sm font-bold text-slate-900">Full System Access</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Administrators can access and manage all system, organization, project, team, and
                work-management capabilities.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              </span>
              Allowed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100">
                <Minus className="w-3.5 h-3.5 text-slate-400" />
              </span>
              Not available
            </span>
          </div>
        </div>

        {/* Matrix table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left font-bold text-slate-600 text-xs uppercase tracking-wider px-4 py-3 min-w-[260px]">
                  Capability
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    className={`px-3 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap w-[130px] ${
                      role === 'ADMIN' ? 'bg-[#0d9488]/[0.07]' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <RoleBadge role={role} />
                      <span className="text-[10px] font-semibold text-slate-400 normal-case tracking-normal">
                        {roleCounts[role]} user{roleCounts[role] !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {GROUPS.map((group) => {
              const Icon = group.icon;
              const isOpen = open[group.id];
              return (
                <tbody key={group.id}>
                  <tr className="bg-slate-50/70 border-y border-slate-200/70">
                    <td colSpan={5} className="p-0">
                      <button
                        type="button"
                        onClick={() => toggle(group.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-100/60 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-md bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-[#0d9488]" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 shrink-0">
                          {group.title}
                        </span>
                        <span className="hidden md:inline text-[11px] text-slate-400 truncate flex-1">
                          {group.note}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {group.rows.length} permissions
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </td>
                  </tr>

                  {isOpen &&
                    group.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-slate-700">{row.label}</td>
                        {ROLES.map((role) => {
                          const allowed = row.check(role);
                          return (
                            <td
                              key={role}
                              className={`px-3 py-2.5 text-center ${
                                role === 'ADMIN' ? 'bg-[#0d9488]/[0.05]' : ''
                              }`}
                            >
                              {allowed ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50">
                                  <Check className="w-4 h-4 text-emerald-600" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100">
                                  <Minus className="w-4 h-4 text-slate-400" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  {isOpen && (
                    <tr className="bg-slate-50/70 border-t border-slate-200/70">
                      <td className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Granted in this section
                      </td>
                      {ROLES.map((role) => (
                        <td
                          key={role}
                          className={`px-3 py-2 text-center ${
                            role === 'ADMIN' ? 'bg-[#0d9488]/[0.05]' : ''
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-700">
                            {countGranted(group.rows, role)} / {group.rows.length}
                          </span>
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>

        {/* 3 · Group 5 — Admin Actions (compact, action-based) */}
        <div className="border-t border-slate-200">
          <button
            type="button"
            onClick={() => toggle('actions')}
            aria-expanded={open.actions}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left bg-slate-50/70 hover:bg-slate-100/60 transition-colors"
          >
            <span className="w-6 h-6 rounded-md bg-[#0d9488]/10 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#0d9488]" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 shrink-0">
              Admin Actions
            </span>
            <span className="hidden md:inline text-[11px] text-slate-400 truncate flex-1">
              Administrative operations · all enabled for Admin
            </span>
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
              {ADMIN_ACTIONS.length} actions
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                open.actions ? 'rotate-180' : ''
              }`}
            />
          </button>

          {open.actions && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {ADMIN_ACTIONS.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 shrink-0">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                  <span className="text-xs font-medium text-slate-700 truncate">{action.label}</span>
                  <span className="ml-auto text-[10px] font-semibold text-slate-400 shrink-0">Admin</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend + admin bypass note */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-50">
              <Check className="w-3 h-3 text-emerald-600" />
            </span>
            Allowed for this role within its scope
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100">
              <Minus className="w-3 h-3 text-slate-400" />
            </span>
            Not available
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <Lock className="w-3.5 h-3.5 text-[#0d9488]" />
            Admin bypasses project membership, project role and team restrictions everywhere.
          </span>
        </div>
      </div>
    </div>
  );
};
