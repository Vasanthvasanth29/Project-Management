import type { Role, TaskStatus, TransitionStatus, Priority, UserStatus, SprintStatus, BugStatus, BugSeverity, FileRecord } from '../types';

export const getRoleLabel = (role: Role): string => {
  const labels: Record<Role, string> = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'Project Manager',
    TEAM_LEADER: 'Team Leader',
    MEMBER: 'Member',
  };
  return labels[role];
};

export const getRoleColor = (role: Role): string => {
  const colors: Record<Role, string> = {
    ADMIN: 'badge-purple',
    PROJECT_MANAGER: 'badge-teal',
    TEAM_LEADER: 'badge-blue',
    MEMBER: 'badge-gray',
  };
  return colors[role];
};

// CANCELLED is a terminal display status (DONE + resolution CANCELLED), so
// badge helpers accept it alongside the workflow statuses.
export const getStatusColor = (status: TransitionStatus): string => {
  const colors: Record<TransitionStatus, string> = {
    TODO: 'badge-gray',
    IN_PROGRESS: 'badge-teal',
    IN_REVIEW: 'badge-blue',
    TESTING: 'badge-amber',
    BUG_FIX: 'badge-red',
    RETEST: 'badge-orange',
    BLOCKED: 'badge-red',
    DONE: 'badge-green',
    CANCELLED: 'badge-gray',
    'IN TEAM BACKLOG': 'badge-gray',
    IMPLEMENT: 'badge-blue',
    FUNNEL: 'badge-orange',
    // Initiative workflow (issue-type specific): TO DO / IN PROGRESS / DONE hues
    BACKLOG: 'badge-gray',
    ASSESSMENT: 'badge-orange',
    ON_BOARD: 'badge-indigo',
    READY_FOR_DEVELOPMENT: 'badge-blue',
    IN_DEVELOPMENT: 'badge-teal',
    ON_HOLD: 'badge-amber',
    DEVELOPMENT_COMPLETE: 'badge-purple',
    READY_FOR_DEPLOYMENT: 'badge-indigo',
    DEPLOYMENT: 'badge-orange',
    VALIDATION: 'badge-blue',
    COMPLETED: 'badge-green',
  };
  return colors[status];
};

export const getStatusLabel = (status: TransitionStatus): string => {
  const labels: Record<TransitionStatus, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    TESTING: 'Testing',
    BUG_FIX: 'Bug Fix',
    RETEST: 'Re-test',
    BLOCKED: 'Blocked',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
    'IN TEAM BACKLOG': 'In Team Work Queue',
    IMPLEMENT: 'Implement',
    FUNNEL: 'Funnel',
    BACKLOG: 'Backlog',
    ASSESSMENT: 'Assessment',
    ON_BOARD: 'On Board',
    READY_FOR_DEVELOPMENT: 'Ready for Development',
    IN_DEVELOPMENT: 'In Development',
    ON_HOLD: 'On Hold',
    DEVELOPMENT_COMPLETE: 'Development Complete',
    READY_FOR_DEPLOYMENT: 'Ready for Deployment',
    DEPLOYMENT: 'Deployment',
    VALIDATION: 'Validation',
    COMPLETED: 'Completed',
  };
  return labels[status];
};

// A work item finished with a CANCELLED resolution is DONE in the data model
// but must never render (or count) as Done. These two helpers are the single
// place that mapping lives: use them anywhere status is displayed or aggregated.
interface WorkItemStatus {
  status: string;
  resolution?: string;
}

export const isCancelledWorkItem = (task: WorkItemStatus): boolean =>
  task.status === 'CANCELLED' || (task.status === 'DONE' && task.resolution === 'CANCELLED');

export const displayTaskStatus = (task: WorkItemStatus): TransitionStatus =>
  isCancelledWorkItem(task) ? 'CANCELLED' : (task.status as TransitionStatus);

export const displayStatusLabel = (task: WorkItemStatus): string =>
  getStatusLabel(displayTaskStatus(task));

export const displayStatusColor = (task: WorkItemStatus): string =>
  getStatusColor(displayTaskStatus(task));

export const getPriorityColor = (priority: Priority): string => {
  const colors: Record<Priority, string> = {
    LOW: 'badge-green',
    MEDIUM: 'badge-amber',
    HIGH: 'badge-orange',
    CRITICAL: 'badge-red',
  };
  return colors[priority];
};

export const getPriorityDotColor = (priority: Priority): string => {
  const colors: Record<Priority, string> = {
    LOW: 'bg-[#10b981]',
    MEDIUM: 'bg-[#f59e0b]',
    HIGH: 'bg-[#ef4444]',
    CRITICAL: 'bg-[#dc2626]',
  };
  return colors[priority];
};

export const getUserStatusColor = (status: UserStatus): string => {
  const colors: Record<UserStatus, string> = {
    INVITATION_PENDING: 'badge-amber',
    ACTIVE: 'badge-green',
    INACTIVE: 'badge-gray',
  };
  return colors[status];
};

export const getUserStatusLabel = (status: UserStatus): string => {
  const labels: Record<UserStatus, string> = {
    INVITATION_PENDING: 'Invitation Pending',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
  };
  return labels[status];
};

export const getSprintStatusColor = (status: SprintStatus): string => {
  const colors: Record<SprintStatus, string> = {
    PLANNED: 'badge-gray',
    ACTIVE: 'badge-teal',
    COMPLETED: 'badge-green',
  };
  return colors[status];
};

export const getBugStatusColor = (status: BugStatus): string => {
  const colors: Record<BugStatus, string> = {
    OPEN: 'badge-red',
    IN_PROGRESS: 'badge-amber',
    FIXED: 'badge-green',
    RETESTING: 'badge-amber',
    CLOSED: 'badge-green',
    REOPENED: 'badge-red',
  };
  return colors[status];
};

export const getBugSeverityColor = (severity: BugSeverity): string => {
  const colors: Record<BugSeverity, string> = {
    LOW: 'badge-green',
    MEDIUM: 'badge-amber',
    HIGH: 'badge-orange',
    CRITICAL: 'badge-red',
  };
  return colors[severity];
};

// ---------------------------------------------------------------------------
// ADMIN FULL-ACCESS MODEL
// The ADMIN role is a true system administrator: it bypasses project
// membership, project role, team membership and normal role permissions.
// Every capability helper in this file returns true for ADMIN, so call sites
// never have to spell out the bypass themselves. Use `isAdmin(role)` for the
// membership/scoping bypasses (project lists, team lists, work-item scopes).
// ---------------------------------------------------------------------------

export const isAdmin = (role: Role | undefined | null): boolean => role === 'ADMIN';

// ---- ORGANIZATION-LEVEL CAPABILITIES ----
// Discovery vs. authorization: every role can SEE the organization-wide lists
// (View All Projects / Teams / Users). What a role is allowed to DO is decided
// by the authorization helpers below (Access Any Project, management rights).

/** View All Projects — every role sees the project list (discovery only). */
export const canViewAllProjects = (_role?: Role | null): boolean => true;

/** View All Teams — every role sees the team list (discovery only). */
export const canViewAllTeams = (_role?: Role | null): boolean => true;

/** View All Users — every role can view users (discovery only). */
export const canViewAllUsers = (_role?: Role | null): boolean => true;

/** Access Any Project — open/manage any project regardless of membership. */
export const canAccessAnyProject = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER';

export const canViewAllWorkItems = (role: Role | undefined | null): boolean => isAdmin(role);

export const canViewAllIterations = (role: Role | undefined | null): boolean => isAdmin(role);

/** Organization-level (cross-project) reporting — Admin only. */
export const canViewAllReports = (role: Role | undefined | null): boolean => isAdmin(role);

export const canViewAuditLogs = (role: Role | undefined | null): boolean => isAdmin(role);

export const canManageOrganization = (role: Role | undefined | null): boolean => isAdmin(role);

// ---- PROJECT-LEVEL CAPABILITIES ----
// Admin bypasses membership everywhere; PM manages projects in its scope;
// TL manages members/roles inside its team/project scope; MEMBER is read-only
// for project administration.

export const canManageProjectMembers = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER' || role === 'TEAM_LEADER';

export const canManageProjectRoles = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER' || role === 'TEAM_LEADER';

export const canManageProjectSettings = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER';

export const canCreateProjects = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER';

export const canArchiveProjects = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER';

// Destructive project deletion is not part of the finalized matrix: Admin only.
export const canDeleteProjects = (role: Role | undefined | null): boolean => isAdmin(role);

// ---- USER MANAGEMENT HIERARCHY ----
// Admin manages every role. PM manages Team Leaders and Members (within its
// project scope). Team Leader manages Members (within its team/project scope).
// Member manages nobody.

/** Can this role manage at least one other user role? */
export const canManageUsers = (role: Role | undefined | null): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER' || role === 'TEAM_LEADER';

/** Creating/inviting users is a system-level operation — Admin only. */
export const canCreateUsers = (role: Role | undefined | null): boolean => isAdmin(role);

/** Can `actorRole` edit/manage a user holding `targetRole`? */
export const canManageUser = (
  actorRole: Role | undefined | null,
  targetRole: Role | undefined | null
): boolean => {
  if (!actorRole || !targetRole) return false;
  if (actorRole === 'ADMIN') return true;
  if (actorRole === 'PROJECT_MANAGER') return targetRole === 'TEAM_LEADER' || targetRole === 'MEMBER';
  if (actorRole === 'TEAM_LEADER') return targetRole === 'MEMBER';
  return false;
};


// ---- WORK ITEM CAPABILITIES (ADMIN can manage any work item, any assignee) ----

export const canManageAnyWorkItem = (role: Role | undefined | null): boolean => isAdmin(role);

export const canAssignTasks = (role: Role): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER' || role === 'TEAM_LEADER';

export const canManageWorkflow = (role: Role): boolean =>
  role === 'PROJECT_MANAGER' || isAdmin(role);

// Iteration lifecycle permissions (frontend-only, based on the authenticated user's existing role).
// TL / PM / ADMIN may manage sprint lifecycle; MEMBER is read-only for sprints.
export const canManageSprint = (role: Role | undefined): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER' || role === 'TEAM_LEADER';

export const canStartSprint = (role: Role | undefined): boolean => canManageSprint(role);

export const canCompleteSprint = (role: Role | undefined): boolean => canManageSprint(role);

export const canEditSprint = (role: Role | undefined): boolean => canManageSprint(role);

// Archiving: granted where the application's permission model supports it (PM/ADMIN).
export const canArchiveSprint = (role: Role | undefined): boolean =>
  isAdmin(role) || role === 'PROJECT_MANAGER';

// Deletion is an admin-only, destructive action.
export const canDeleteSprint = (role: Role | undefined): boolean => isAdmin(role);

export const getDashboardPath = (role: Role): string => {
  const paths: Record<Role, string> = {
    ADMIN: '/admin',
    PROJECT_MANAGER: '/pm',
    TEAM_LEADER: '/tl',
    MEMBER: '/member',
  };
  return paths[role];
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ---- FILE PERMISSIONS ----

export const canUploadFiles = (role: Role): boolean => {
  return true; // All authenticated roles can upload
};

export const canDeleteFile = (role: Role, fileRecord: FileRecord, currentUserId: string): boolean => {
  if (role === 'ADMIN') return true;
  if (role === 'PROJECT_MANAGER') return true;
  if (fileRecord.uploadedById === currentUserId) return true;
  return false;
};

export const canPreviewFile = (mimeType: string): boolean => {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/json'
  );
};

export const canViewVersionHistory = (role: Role): boolean => {
  return true; // All authenticated roles can view version history
};
