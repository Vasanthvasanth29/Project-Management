import React from 'react';
import type { TaskStatus, Priority, UserStatus, SprintStatus, BugStatus, BugSeverity, Role, IssueResolution } from '../../types';
import {
  getStatusColor, getStatusLabel, getPriorityColor,
  getUserStatusColor, getUserStatusLabel, getSprintStatusColor,
  getBugStatusColor, getBugSeverityColor, getRoleColor, getRoleLabel
} from '../../utils/roleUtils';

interface StatusBadgeProps {
  status: TaskStatus;
  /**
   * The issue's resolution, when known. Cancelled issues normally carry the real
   * `status: 'CANCELLED'`; the legacy form (status DONE + resolution CANCELLED)
   * still maps here — every surface that displays status must show "Cancelled",
   * never "Done" — this is the one place that rule is enforced.
   */
  resolution?: IssueResolution;
  /** Render the value as plain dark text (no coloured pill) */
  plain?: boolean;
}
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, resolution, plain = false }) => {
  const isCancelled = status === 'CANCELLED' || (status === 'DONE' && resolution === 'CANCELLED');
  return (
    <span className={plain ? 'font-semibold text-slate-800' : isCancelled ? 'badge-gray' : getStatusColor(status)}>
      {isCancelled ? 'Cancelled' : getStatusLabel(status)}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: Priority;
  /** Render the value as plain dark text (no coloured pill) */
  plain?: boolean;
}
export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, plain = false }) => (
  <span className={plain ? 'font-semibold text-slate-800' : getPriorityColor(priority)}>
    {priority.charAt(0) + priority.slice(1).toLowerCase()}
  </span>
);

interface UserStatusBadgeProps {
  status: UserStatus;
}
export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status }) => (
  <span className={getUserStatusColor(status)}>{getUserStatusLabel(status)}</span>
);

interface SprintStatusBadgeProps {
  status: SprintStatus;
}
export const SprintStatusBadge: React.FC<SprintStatusBadgeProps> = ({ status }) => (
  <span className={getSprintStatusColor(status)}>
    {status.charAt(0) + status.slice(1).toLowerCase()}
  </span>
);

interface BugStatusBadgeProps {
  status: BugStatus;
}
export const BugStatusBadge: React.FC<BugStatusBadgeProps> = ({ status }) => (
  <span className={getBugStatusColor(status)}>
    {status.replace(/_/g, ' ').charAt(0) + status.replace(/_/g, ' ').slice(1).toLowerCase()}
  </span>
);

interface BugSeverityBadgeProps {
  severity: BugSeverity;
}
export const BugSeverityBadge: React.FC<BugSeverityBadgeProps> = ({ severity }) => (
  <span className={getBugSeverityColor(severity)}>
    {severity.charAt(0) + severity.slice(1).toLowerCase()}
  </span>
);

interface RoleBadgeProps {
  role: Role;
}
export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <span className={getRoleColor(role)}>{getRoleLabel(role)}</span>
);
