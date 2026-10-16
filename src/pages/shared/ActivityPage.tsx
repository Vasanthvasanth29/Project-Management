import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatTimeAgo, formatDate, formatDateTime } from '../../utils/dateUtils';
import { getRoleLabel } from '../../utils/roleUtils';
import {
  ShieldCheck, Filter, Search, FolderKanban, Users, Sparkles, X, ChevronDown, ChevronRight,
  ArrowRight, Clock, Download, FileText, FileSpreadsheet, RefreshCw, AlertTriangle,
  CheckCircle, GitBranch, Package, MessageSquare, Link2, UserPlus, Zap,
  Calendar, ChevronLeft, RotateCcw, Eye
} from 'lucide-react';
import type { Activity, ActivityFilterState } from '../../types';
import { issuePath } from '../../utils/issueUrl';
import { ACTIVITY_TYPE_OPTIONS } from '../../types';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

const DATE_PRESETS = [
  { key: 'all' as const, label: 'All Time' },
  { key: 'today' as const, label: 'Today' },
  { key: '7days' as const, label: 'Last 7 Days' },
  { key: '30days' as const, label: 'Last 30 Days' },
  { key: 'custom' as const, label: 'Custom Range' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'TASK', label: 'Tasks' },
  { value: 'BUG', label: 'Bugs' },
  { value: 'PROJECT', label: 'Projects' },
  { value: 'SPRINT', label: 'Iterations' },
  { value: 'RELEASE', label: 'Releases' },
  { value: 'USER', label: 'Users' },
  { value: 'DEPENDENCY', label: 'Dependencies' },
  { value: 'COMMENT', label: 'Comments' },
];

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  TASK_CREATED: CheckCircle,
  TASK_UPDATED: CheckCircle,
  STATUS_CHANGED: ArrowRight,
  ASSIGNMENT_CHANGED: UserPlus,
  COMMENT_ADDED: MessageSquare,
  SPRINT_STARTED: Zap,
  SPRINT_COMPLETED: CheckCircle,
  RELEASE_CREATED: Package,
  RELEASE_UPDATED: Package,
  DEPENDENCY_ADDED: Link2,
  DEPENDENCY_REMOVED: Link2,
  APPROVAL_REQUESTED: Eye,
  APPROVAL_APPROVED: CheckCircle,
  APPROVAL_REJECTED: X,
  USER_CREATED: UserPlus,
  USER_UPDATED: UserPlus,
  PROJECT_CREATED: FolderKanban,
  PROJECT_UPDATED: FolderKanban,
  BUG_CREATED: AlertTriangle,
  BUG_UPDATED: AlertTriangle,
  OTHER: Zap,
};

const ACTIVITY_COLORS: Record<string, string> = {
  TASK_CREATED: '#10b981',
  TASK_UPDATED: '#0d9488',
  STATUS_CHANGED: '#6366f1',
  ASSIGNMENT_CHANGED: '#f59e0b',
  COMMENT_ADDED: '#8b5cf6',
  SPRINT_STARTED: '#0d9488',
  SPRINT_COMPLETED: '#10b981',
  RELEASE_CREATED: '#06b6d4',
  RELEASE_UPDATED: '#06b6d4',
  DEPENDENCY_ADDED: '#ef4444',
  DEPENDENCY_REMOVED: '#ef4444',
  APPROVAL_REQUESTED: '#f59e0b',
  APPROVAL_APPROVED: '#10b981',
  APPROVAL_REJECTED: '#ef4444',
  USER_CREATED: '#0d9488',
  USER_UPDATED: '#0d9488',
  PROJECT_CREATED: '#0d9488',
  PROJECT_UPDATED: '#0d9488',
  BUG_CREATED: '#ef4444',
  BUG_UPDATED: '#ef4444',
  OTHER: '#6b7280',
};

function classifyActivity(act: Activity): string {
  const action = act.action.toLowerCase();
  const entityType = act.entityType.toUpperCase();

  if (entityType === 'TASK') {
    if (action.includes('created') || action.includes('created task')) return 'TASK_CREATED';
    if (action.includes('status') || action.includes('moved')) return 'STATUS_CHANGED';
    if (action.includes('assigned') || action.includes('reassigned')) return 'ASSIGNMENT_CHANGED';
    if (action.includes('comment') || action.includes('replied')) return 'COMMENT_ADDED';
    if (action.includes('updated') || action.includes('edited') || action.includes('modified')) return 'TASK_UPDATED';
    return 'TASK_UPDATED';
  }
  if (entityType === 'BUG') {
    if (action.includes('created') || action.includes('reported')) return 'BUG_CREATED';
    return 'BUG_UPDATED';
  }
  if (entityType === 'PROJECT') {
    if (action.includes('created')) return 'PROJECT_CREATED';
    return 'PROJECT_UPDATED';
  }
  if (entityType === 'SPRINT') {
    if (action.includes('started') || action.includes('activated')) return 'SPRINT_STARTED';
    if (action.includes('completed') || action.includes('finished')) return 'SPRINT_COMPLETED';
    return 'SPRINT_STARTED';
  }
  if (entityType === 'RELEASE') {
    if (action.includes('created')) return 'RELEASE_CREATED';
    return 'RELEASE_UPDATED';
  }
  if (entityType === 'USER' || entityType === 'MEMBER') {
    if (action.includes('created') || action.includes('invited') || action.includes('added')) return 'USER_CREATED';
    return 'USER_UPDATED';
  }
  if (action.includes('depend')) {
    if (action.includes('removed') || action.includes('deleted')) return 'DEPENDENCY_REMOVED';
    return 'DEPENDENCY_ADDED';
  }
  if (action.includes('approv')) {
    if (action.includes('reject') || action.includes('denied')) return 'APPROVAL_REJECTED';
    if (action.includes('request') || action.includes('submitted')) return 'APPROVAL_REQUESTED';
    return 'APPROVAL_APPROVED';
  }
  return 'OTHER';
}

function getDateRange(preset: string, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    case '7days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case '30days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case 'custom': {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : now;
      return { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

function getEntityNavUrl(act: Activity, navigate: ReturnType<typeof useNavigate>): string | null {
  const entityType = act.entityType.toUpperCase();
  if (entityType === 'TASK') return issuePath(act.entityId);
  if (entityType === 'PROJECT') return `/pm/projects`;
  if (entityType === 'BUG') return `/tl/bugs`;
  return null;
}

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { activities, projects, teams, tasks, bugs, users, sprints, releases } = useAppStore();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<ActivityFilterState>({
    projectId: 'ALL',
    userId: 'ALL',
    teamId: 'ALL',
    entityType: 'ALL',
    taskId: 'ALL',
    sprintId: 'ALL',
    releaseId: 'ALL',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    searchQuery: '',
  });

  const updateFilter = useCallback((updates: Partial<ActivityFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setVisibleCount(PAGE_SIZE);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      projectId: 'ALL',
      userId: 'ALL',
      teamId: 'ALL',
      entityType: 'ALL',
      taskId: 'ALL',
      sprintId: 'ALL',
      releaseId: 'ALL',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      searchQuery: '',
    });
    setVisibleCount(PAGE_SIZE);
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        setRefreshTick((c) => c + 1);
      }, 30000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh]);

  // Role-based project scoping
  const accessibleProjects = useMemo(() => {
    if (!currentUser) return [];
    const role = currentUser.role;
    if (role === 'ADMIN' || role === 'PROJECT_MANAGER') return projects;
    if (role === 'TEAM_LEADER') {
      const myTeams = teams.filter((t) => t.teamLeaderId === currentUser.id || t.id === currentUser.teamId);
      const myTeamIds = myTeams.map((t) => t.id);
      return projects.filter((p) => p.teamIds.some((tid) => myTeamIds.includes(tid)));
    }
    const myTeamId = currentUser.teamId;
    return projects.filter(
      (p) => (myTeamId && p.teamIds.includes(myTeamId)) || tasks.some((t) => t.assigneeId === currentUser.id && t.projectId === p.id)
    );
  }, [currentUser, projects, teams, tasks]);

  const accessibleProjectIds = useMemo(() => new Set(accessibleProjects.map((p) => p.id)), [accessibleProjects]);

  // Role-scoped activities
  const roleScopedActivities = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'ADMIN') return activities;
    if (currentUser.role === 'PROJECT_MANAGER') {
      return activities.filter((act) => {
        let projId = act.projectId;
        if (!projId) {
          if (act.entityType === 'PROJECT') projId = act.entityId;
          else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
          else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
          else if (act.entityType === 'SPRINT') projId = sprints.find((s) => s.id === act.entityId)?.projectId;
        }
        return projId ? accessibleProjectIds.has(projId) : false;
      });
    }
    if (currentUser.role === 'TEAM_LEADER') {
      const myTeams = teams.filter((t) => t.teamLeaderId === currentUser.id || t.id === currentUser.teamId);
      const teamMemberIds = new Set<string>();
      myTeams.forEach((t) => {
        t.memberIds.forEach((id) => teamMemberIds.add(id));
        if (t.teamLeaderId) teamMemberIds.add(t.teamLeaderId);
      });
      teamMemberIds.add(currentUser.id);
      return activities.filter((act) => {
        if (teamMemberIds.has(act.userId)) return true;
        let projId = act.projectId;
        if (!projId) {
          if (act.entityType === 'PROJECT') projId = act.entityId;
          else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
          else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
        }
        return projId ? accessibleProjectIds.has(projId) : false;
      });
    }
    return activities.filter((act) => {
      if (act.userId === currentUser.id) return true;
      let projId = act.projectId;
      if (!projId) {
        if (act.entityType === 'PROJECT') projId = act.entityId;
        else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
        else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
      }
      return projId ? accessibleProjectIds.has(projId) : false;
    });
  }, [currentUser, activities, accessibleProjectIds, tasks, bugs, teams, sprints, refreshTick]);

  // Apply all filters
  const filteredActivities = useMemo(() => {
    const { from, to } = getDateRange(filters.datePreset, filters.dateFrom, filters.dateTo);

    return roleScopedActivities.filter((act) => {
      // Project filter
      if (filters.projectId !== 'ALL') {
        let projId = act.projectId;
        if (!projId) {
          if (act.entityType === 'PROJECT') projId = act.entityId;
          else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
          else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
        }
        if (projId !== filters.projectId) return false;
      }

      // User filter
      if (filters.userId !== 'ALL' && act.userId !== filters.userId) return false;

      // Team filter
      if (filters.teamId !== 'ALL') {
        const team = teams.find((t) => t.id === filters.teamId);
        if (team) {
          const teamMemberIds = new Set(team.memberIds);
          if (team.teamLeaderId) teamMemberIds.add(team.teamLeaderId);
          if (!teamMemberIds.has(act.userId)) return false;
        }
      }

      // Entity type filter
      if (filters.entityType !== 'ALL') {
        const classified = classifyActivity(act);
        const mappedType = filters.entityType === 'DEPENDENCY' ? 'DEPENDENCY' :
                          filters.entityType === 'COMMENT' ? 'COMMENT_ADDED' :
                          filters.entityType;
        if (!classified.startsWith(mappedType) && classified !== mappedType) return false;
      }

      // Task filter
      if (filters.taskId !== 'ALL' && act.entityId !== filters.taskId) return false;

      // Iteration filter
      if (filters.sprintId !== 'ALL') {
        const sprint = sprints.find((s) => s.id === filters.sprintId);
        if (sprint) {
          const taskInSprint = tasks.find((t) => t.id === act.entityId && t.sprintId === filters.sprintId);
          const isSprintActivity = act.entityType === 'SPRINT' && act.entityId === filters.sprintId;
          if (!taskInSprint && !isSprintActivity) return false;
        }
      }

      // Release filter
      if (filters.releaseId !== 'ALL') {
        const release = releases.find((r) => r.id === filters.releaseId);
        if (release) {
          const isReleaseActivity = act.entityType === 'RELEASE' && act.entityId === filters.releaseId;
          const taskInRelease = release.taskIds.includes(act.entityId);
          if (!isReleaseActivity && !taskInRelease) return false;
        }
      }

      // Date range filter
      if (from || to) {
        const actDate = new Date(act.createdAt);
        if (from && actDate < from) return false;
        if (to && actDate > to) return false;
      }

      // Text search
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesAction = act.action.toLowerCase().includes(q);
        const matchesEntity = act.entityTitle.toLowerCase().includes(q);
        const matchesType = act.entityType.toLowerCase().includes(q);
        const matchUser = users.find((u) => u.id === act.userId);
        const matchesUser = matchUser?.name.toLowerCase().includes(q) ?? false;
        let projIdForSearch = act.projectId;
        if (!projIdForSearch) {
          if (act.entityType === 'PROJECT') projIdForSearch = act.entityId;
          else if (act.entityType === 'TASK') projIdForSearch = tasks.find((t) => t.id === act.entityId)?.projectId;
          else if (act.entityType === 'BUG') projIdForSearch = bugs.find((b) => b.id === act.entityId)?.projectId;
        }
        const matchProject = projects.find((p) => p.id === projIdForSearch);
        const matchesProject = matchProject?.name.toLowerCase().includes(q) ?? false;
        if (!matchesAction && !matchesEntity && !matchesType && !matchesUser && !matchesProject) return false;
      }

      return true;
    });
  }, [roleScopedActivities, filters, tasks, bugs, users, projects, teams, sprints, releases]);

  // Summary stats
  const summary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayActivities = filteredActivities.filter((a) => new Date(a.createdAt) >= todayStart);
    const taskChanges = filteredActivities.filter((a) => ['TASK', 'BUG'].includes(a.entityType.toUpperCase()));
    const sprintReleaseChanges = filteredActivities.filter((a) => ['SPRINT', 'RELEASE'].includes(a.entityType.toUpperCase()));
    const riskActivities = filteredActivities.filter((a) => {
      const classified = classifyActivity(a);
      return ['DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'APPROVAL_REJECTED', 'STATUS_CHANGED'].includes(classified);
    });

    return {
      total: filteredActivities.length,
      today: todayActivities.length,
      taskChanges: taskChanges.length,
      sprintRelease: sprintReleaseChanges.length,
      risk: riskActivities.length,
    };
  }, [filteredActivities]);

  const visibleActivities = useMemo(() => filteredActivities.slice(0, visibleCount), [filteredActivities, visibleCount]);
  const hasMore = visibleCount < filteredActivities.length;

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    visibleActivities.forEach((act) => {
      const dateKey = formatDate(act.createdAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(act);
    });
    return groups;
  }, [visibleActivities]);

  // Export helpers
  const handleExportCSV = useCallback(() => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity Title', 'Project'];
    const rows = filteredActivities.map((act) => {
      const user = users.find((u) => u.id === act.userId);
      let projId = act.projectId;
      if (!projId) {
        if (act.entityType === 'PROJECT') projId = act.entityId;
        else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
        else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
      }
      const project = projects.find((p) => p.id === projId);
      return [
        formatDateTime(act.createdAt),
        user?.name || 'Unknown',
        act.action,
        act.entityType,
        act.entityTitle,
        project?.name || '—',
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowexec-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Activity log exported as CSV');
  }, [filteredActivities, users, tasks, projects]);

  const handleExportPDF = useCallback(() => {
    const lines: string[] = [];
    lines.push('FlowExec Activity Audit Report');
    lines.push(`Generated: ${formatDateTime(new Date().toISOString())}`);
    lines.push(`Total Records: ${filteredActivities.length}`);
    lines.push('---');

    groupedActivities[dateString()]?.forEach(() => {});
    Object.entries(groupedActivities).forEach(([date, acts]) => {
      lines.push('');
      lines.push(`== ${date} ==`);
      acts.forEach((act) => {
        const user = users.find((u) => u.id === act.userId);
        lines.push(`  [${formatDateTime(act.createdAt)}] ${user?.name || 'Unknown'} - ${act.action} "${act.entityTitle}" (${act.entityType})`);
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowexec-activity-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Activity log exported');
  }, [filteredActivities, groupedActivities, users]);

  if (!currentUser) return null;

  const scopeBadgeText = () => {
    switch (currentUser.role) {
      case 'ADMIN': return 'Organization-Wide Audit Scope';
      case 'PROJECT_MANAGER': return `PM Scope (${accessibleProjects.length} Managed Project${accessibleProjects.length !== 1 ? 's' : ''})`;
      case 'TEAM_LEADER': return `Team Lead Scope (${accessibleProjects.length} Assigned Project${accessibleProjects.length !== 1 ? 's' : ''})`;
      default: return 'Member Activity Stream';
    }
  };

  const activeFilterCount = [
    filters.projectId !== 'ALL',
    filters.userId !== 'ALL',
    filters.teamId !== 'ALL',
    filters.entityType !== 'ALL',
    filters.taskId !== 'ALL',
    filters.sprintId !== 'ALL',
    filters.releaseId !== 'ALL',
    filters.datePreset !== 'all',
    filters.searchQuery.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#0d9488]/10 text-[#0d9488] text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            {scopeBadgeText()}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1a1d23] tracking-tight font-display">
            Activity Audit Timeline
          </h1>
          <p className="text-xs text-[#9ca3af] mt-1">
            Chronological audit stream for {currentUser.name} ({getRoleLabel(currentUser.role)})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              autoRefresh
                ? 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/30'
                : 'bg-white text-[#6b7280] border-[#e2e5ea] hover:bg-[#f8fafc]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#0d9488]">{summary.total}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Total Activities</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#06b6d4]">{summary.today}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Today</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#6366f1]">{summary.taskChanges}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Task Changes</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#f59e0b]">{summary.sprintRelease}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Iteration/Release</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#ef4444]">{summary.risk}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Risk Activity</div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#e2e5ea]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-xs font-bold text-[#1a1d23] hover:text-[#0d9488] transition-colors"
            >
              <Filter className="w-4 h-4" />
              Advanced Filters
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#0d9488] text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[10px] text-[#ef4444] font-semibold hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset All
                </button>
              )}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#6b7280] text-[10px] font-semibold border border-[#e2e5ea] transition-colors"
              >
                <FileSpreadsheet className="w-3 h-3" />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#6b7280] text-[10px] font-semibold border border-[#e2e5ea] transition-colors"
              >
                <FileText className="w-3 h-3" />
                Export
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="p-4 space-y-4 animate-slide-in">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Search action, task, project, or user..."
                value={filters.searchQuery}
                onChange={(e) => updateFilter({ searchQuery: e.target.value })}
                className="input pl-9 text-xs"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => updateFilter({ searchQuery: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#1a1d23]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Project */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <FolderKanban className="w-3 h-3 text-[#0d9488]" />
                  Project
                </label>
                <select
                  value={filters.projectId}
                  onChange={(e) => updateFilter({ projectId: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  <option value="ALL">All Projects</option>
                  {accessibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* User */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#0d9488]" />
                  User
                </label>
                <select
                  value={filters.userId}
                  onChange={(e) => updateFilter({ userId: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  <option value="ALL">All Users</option>
                  {users.filter((u) => u.status === 'ACTIVE').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Team */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#0d9488]" />
                  Team
                </label>
                <select
                  value={filters.teamId}
                  onChange={(e) => updateFilter({ teamId: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  <option value="ALL">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Entity Type */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#0d9488]" />
                  Activity Type
                </label>
                <select
                  value={filters.entityType}
                  onChange={(e) => updateFilter({ entityType: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second row: Iteration, Release, Date Preset */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Iteration */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#0d9488]" />
                  Iteration
                </label>
                <select
                  value={filters.sprintId}
                  onChange={(e) => updateFilter({ sprintId: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  <option value="ALL">All Iterations</option>
                  {sprints.filter((s) => filters.projectId === 'ALL' || s.projectId === filters.projectId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Release */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3 text-[#0d9488]" />
                  Release
                </label>
                <select
                  value={filters.releaseId}
                  onChange={(e) => updateFilter({ releaseId: e.target.value })}
                  className="input text-xs py-1.5"
                >
                  <option value="ALL">All Releases</option>
                  {releases.filter((r) => filters.projectId === 'ALL' || r.projectId === filters.projectId).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Preset */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#0d9488]" />
                  Date Range
                </label>
                <div className="flex gap-1.5">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => updateFilter({ datePreset: preset.key })}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                        filters.datePreset === preset.key
                          ? 'bg-[#0d9488] text-white border-[#0d9488]'
                          : 'bg-white text-[#6b7280] border-[#e2e5ea] hover:bg-[#f8fafc]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Range */}
            {filters.datePreset === 'custom' && (
              <div className="flex items-center gap-3 animate-slide-in">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 block">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter({ dateFrom: e.target.value })}
                    className="input text-xs py-1.5"
                  />
                </div>
                <span className="text-[#9ca3af] mt-5">—</span>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1 block">To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter({ dateTo: e.target.value })}
                    className="input text-xs py-1.5"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            {filters.projectId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0d9488]/10 text-[#0d9488] text-[10px] font-semibold">
                Project: {accessibleProjects.find((p) => p.id === filters.projectId)?.name}
                <button onClick={() => updateFilter({ projectId: 'ALL' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.userId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-[10px] font-semibold">
                User: {users.find((u) => u.id === filters.userId)?.name}
                <button onClick={() => updateFilter({ userId: 'ALL' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.teamId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] text-[10px] font-semibold">
                Team: {teams.find((t) => t.id === filters.teamId)?.name}
                <button onClick={() => updateFilter({ teamId: 'ALL' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.entityType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-semibold">
                Type: {ENTITY_TYPE_OPTIONS.find((o) => o.value === filters.entityType)?.label}
                <button onClick={() => updateFilter({ entityType: 'ALL' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.datePreset !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4] text-[10px] font-semibold">
                {DATE_PRESETS.find((p) => p.key === filters.datePreset)?.label}
                <button onClick={() => updateFilter({ datePreset: 'all' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#94a3b8]/10 text-[#64748b] text-[10px] font-semibold">
                Search: "{filters.searchQuery}"
                <button onClick={() => updateFilter({ searchQuery: '' })}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#e2e5ea] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1a1d23]">
            Activity Timeline
            <span className="text-[#9ca3af] font-normal ml-2">({filteredActivities.length} records)</span>
          </h3>
          <span className="text-[10px] text-[#9ca3af]">Newest first</span>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={ShieldCheck}
              title="No Activity Found"
              description="No activities match your current filters. Try adjusting your search criteria or resetting filters."
              action={{ label: 'Reset Filters', onClick: resetFilters }}
            />
          </div>
        ) : (
          <div className="divide-y divide-[#f1f3f5]">
            {Object.entries(groupedActivities).map(([date, acts]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="px-5 py-2.5 bg-[#f8fafc] border-b border-[#e2e5ea] sticky top-0 z-10">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">{date}</span>
                </div>

                {/* Activity Items */}
                <div className="divide-y divide-[#f8fafc]">
                  {acts.map((act) => {
                    const user = users.find((u) => u.id === act.userId);
                    const classified = classifyActivity(act);
                    const Icon = ACTIVITY_ICONS[classified] || Zap;
                    const iconColor = ACTIVITY_COLORS[classified] || '#6b7280';
                    const isExpanded = expandedActivityId === act.id;
                    const navUrl = getEntityNavUrl(act, navigate);

                    let projId = act.projectId;
                    if (!projId) {
                      if (act.entityType === 'PROJECT') projId = act.entityId;
                      else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
                      else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
                    }
                    const project = projects.find((p) => p.id === projId);

                    return (
                      <div key={act.id} className="px-5 py-3 hover:bg-[#f8fafc] transition-colors group">
                        <div className="flex items-start gap-3">
                          {/* Activity Type Icon */}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${iconColor}15` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: iconColor }} />
                          </div>

                          {/* User Avatar */}
                          {user ? (
                            <Avatar name={user.name} color={user.avatarColor} size="sm" className="mt-0.5 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#e2e5ea] flex-shrink-0" />
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#4b5563] leading-snug">
                                  <span className="font-semibold text-[#1a1d23]">{user?.name || 'System'}</span>
                                  {' '}{act.action}{' '}
                                  {navUrl ? (
                                    <button
                                      onClick={() => navigate(navUrl)}
                                      className="font-semibold text-[#0d9488] hover:underline"
                                    >
                                      {act.entityTitle}
                                    </button>
                                  ) : (
                                    <span className="font-semibold text-[#0d9488]">{act.entityTitle}</span>
                                  )}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeAgo(act.createdAt)}
                                  </span>
                                  <span className="text-[10px] text-[#9ca3af]">
                                    {formatDateTime(act.createdAt)}
                                  </span>
                                  {project && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20">
                                      <FolderKanban className="w-3 h-3" />
                                      {project.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Expand Button */}
                              <button
                                onClick={() => setExpandedActivityId(isExpanded ? null : act.id)}
                                className="p-1 rounded-lg hover:bg-[#e2e5ea] text-[#9ca3af] hover:text-[#6b7280] transition-colors flex-shrink-0"
                                title="View details"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e5ea] animate-slide-in">
                                <div className="grid grid-cols-2 gap-3 text-[11px]">
                                  <div>
                                    <span className="text-[#9ca3af] font-semibold">Activity ID:</span>
                                    <span className="ml-2 text-[#1a1d23] font-mono">{act.id}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#9ca3af] font-semibold">Entity Type:</span>
                                    <span className="ml-2 text-[#1a1d23]">{act.entityType}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#9ca3af] font-semibold">Entity ID:</span>
                                    <span className="ml-2 text-[#1a1d23] font-mono">{act.entityId}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#9ca3af] font-semibold">User ID:</span>
                                    <span className="ml-2 text-[#1a1d23] font-mono">{act.userId}</span>
                                  </div>
                                  {act.metadata && Object.entries(act.metadata).length > 0 && (
                                    <div className="col-span-2 mt-2 pt-2 border-t border-[#e2e5ea]">
                                      <span className="text-[#9ca3af] font-semibold">Changes:</span>
                                      <div className="mt-1.5 space-y-1">
                                        {Object.entries(act.metadata).map(([key, value]) => (
                                          <div key={key} className="flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 rounded bg-[#6366f1]/10 text-[#6366f1] font-mono text-[10px]">{key}</span>
                                            <ArrowRight className="w-3 h-3 text-[#9ca3af]" />
                                            <span className="px-1.5 py-0.5 rounded bg-[#0d9488]/10 text-[#0d9488] font-mono text-[10px]">{value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-3 pt-2 border-t border-[#e2e5ea]">
                                  <span className="text-[10px] text-[#9ca3af]">Full Timestamp: {formatDateTime(act.createdAt)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t border-[#e2e5ea] text-center">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="btn-secondary btn-sm"
            >
              Load More ({filteredActivities.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function dateString(): string {
  return formatDate(new Date().toISOString());
}
