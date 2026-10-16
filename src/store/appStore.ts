import { create } from 'zustand';
import type {
  User, Team, Project, Workflow, Sprint, Task, Bug, Todo, Notification, Activity,
  Release, TaskDependency, AutomationRule, AutomationExecution, Approval,
  Initiative, CustomFieldDefinition, SavedFilter, Scenario, ScenarioChange, SprintConfig,
  TimeLog, OverdueInfo, EnhancedFilterState, ActiveTimer, FileRecord, StorageUsageData,
  TaskStatus, UserStatus, SprintStatus, BugStatus, Priority, ReleaseStatus,
  AutomationTrigger, AutomationCondition, SprintIncompleteTaskAction, ApprovalStatus,
  Comment, CommentAttachment, Organization, Attachment, StoragePlan, IssueResolution,
  RetrospectiveItem, SprintRetrospective, RetroActionStatus,
  SprintLink, SprintLinkRelationship, DependencyType, StatusTransition, TransitionStatus,
  ProgramIncrement
} from '../types';
import {
  organization as initOrganization,
  users as initUsers, teams as initTeams, projects as initProjects,
  workflows as initWorkflows, sprints as initSprints, tasks as initTasks,
  bugs as initBugs, todos as initTodos, notifications as initNotifications,
  activities as initActivities,
  sprintRetrospectives as initRetrospectives,
  retrospectiveItems as initRetroItems,
  sprintLinks as initSprintLinks,
  programIncrements as initProgramIncrements,
} from '../data/mockData';
import {
  validateUploadQuota,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_USER_STORAGE_LIMIT_BYTES,
  DEFAULT_ORG_STORAGE_LIMIT_BYTES
} from '../utils/storageUtils';
import { SEED_CUSTOM_FIELD_DEFINITIONS } from '../data/customFields';
import {
  applyCustomFieldSnapshot,
  readCustomFieldSnapshot,
  persistCustomFieldSnapshot,
} from '../utils/customFieldPersistence';
import { isDuplicateLink, ISSUE_LINK_LABEL, plainTextFromHtml } from '../utils/issueLinks';
import { getIssueKey, mintIssueKey } from '../utils/workItemHierarchy';
import {
  deriveIssueKeyPrefix,
  getIssueKeyPrefix,
  normalizeProjectName,
  rekeyIssueKey,
  rekeyPrefixInText,
  replaceProjectNameInText,
} from '../utils/projectIdentity';
import {
  applyProjectIdentityOverrides,
  removeProjectIdentityOverride,
  saveProjectIdentityOverride,
} from '../utils/projectIdentityPersistence';
import { buildStatusTransition } from '../utils/statusTransitions';
import { evaluateInitiativeStatusChange, explainInitiativeTransition, type InitiativeStatusChange } from '../utils/initiativeWorkflow';
import {
  persistTaskDependency,
  unpersistTaskDependency,
  resolvePersistedIssueLink,
  readPersistedIssueLinks,
  rekeyPersistedIssueLinks,
  reconcilePersistedIssueLinks,
} from '../utils/issueLinkPersistence';

/**
 * Optional context for a status/resolution change on a sprint issue that is
 * not a store Task yet. The board already knows the issue's previous status,
 * who is dragging it and when it entered that status — passing that in lets
 * the override path write the exact same transition record the Task path does.
 */
export interface IssueOverrideChange {
  previousStatus?: TaskStatus;
  userId?: string;
  /** When the issue entered its previous status (defaults to the record already stored). */
  sourceEnteredAt?: string;
  /** Terminal resolution applied together with the status (e.g. a cancellation). */
  resolution?: IssueResolution;
}

/**
 * Result of a status-changing store action. `ok: false` means the Initiative
 * workflow gate refused the move — `reason` is a ready-to-display message.
 * Non-status fields may still have been saved by `updateTask`; only the status
 * change was dropped.
 */
export interface StatusChangeResult {
  ok: boolean;
  reason?: string;
}

/** Appends one transition record to a not-yet-materialised issue's history. */
const recordOverrideTransition = (params: {
  history?: StatusTransition[];
  from?: TransitionStatus;
  to: TransitionStatus;
  sourceEnteredAt?: string;
  userId?: string;
  users: User[];
}): StatusTransition[] | undefined => {
  const { history = [], from, to, sourceEnteredAt, userId, users } = params;
  if (!from || from === to) return undefined;
  const last = history.length > 0 ? history[history.length - 1] : undefined;
  const actor = userId ? users.find((u) => u.id === userId) : undefined;
  return [
    ...history,
    buildStatusTransition({
      fromStatus: from,
      toStatus: to,
      sourceEnteredAt: sourceEnteredAt || last?.changedAt || new Date().toISOString(),
      actor: actor
        ? { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl, avatarColor: actor.avatarColor }
        : { id: userId || 'system' },
    }),
  ];
};

interface AppState {
  // Data
  users: User[];
  teams: Team[];
  projects: Project[];
  workflows: Workflow[];
  sprints: Sprint[];
  /** Program Increments — parents of sprints (Project → PI → Iteration). */
  pis: ProgramIncrement[];
  tasks: Task[];
  bugs: Bug[];
  todos: Todo[];
  notifications: Notification[];
  activities: Activity[];
  releases: Release[];
  taskDependencies: TaskDependency[];
  automationRules: AutomationRule[];
  automationExecutions: AutomationExecution[];
  initiatives: Initiative[];
  customFieldDefinitions: CustomFieldDefinition[];
  savedFilters: SavedFilter[];
  scenarios: Scenario[];
  sprintConfigs: Record<string, SprintConfig>;
  bulkSelectedTaskIds: string[];
  // Workflow state for sprint issues that are rendered by the Live Iteration page and
  // the Iteration Board but are not (yet) store tasks. Keeping it in the store means both
  // boards read and write one shared sprint state instead of component-local copies.
  issueStatusOverrides: Record<string, TaskStatus>;
  issueResolutions: Record<string, IssueResolution>;
  issueComments: Record<string, Comment[]>;
  /**
   * Transition history for the same not-yet-materialised sprint issues, so a
   * drag on the board records the change and the issue detail page shows it
   * once the issue is opened (the records are carried onto the Task then).
   */
  issueStatusTransitions: Record<string, StatusTransition[]>;
  /** When the issue last entered its current override status. */
  issueStatusEnteredAt: Record<string, string>;
  /**
   * Assignee override for the same not-yet-materialised sprint issues: the
   * transition dialog's Assignee selector writes here so every board, list and
   * the eventual materialised Task agree on who owns the issue.
   */
  issueAssigneeOverrides: Record<string, string>;
  approvals: Approval[];
  activeTimer: ActiveTimer | null;
  organization: Organization;
  fileRecords: FileRecord[];

  // FILE ACTIONS
  addFileRecord: (record: Omit<FileRecord, 'id' | 'createdAt' | 'updatedAt'>) => FileRecord;
  removeFileRecord: (fileId: string, userId: string) => void;
  getFileRecordsForTask: (taskId: string) => FileRecord[];
  getFileRecordsForBug: (bugId: string) => FileRecord[];
  getFileVersions: (versionGroupId: string) => FileRecord[];
  getStorageUsage: (projectId: string) => StorageUsageData;

  // STORAGE & ATTACHMENT ACTIONS
  uploadTaskAttachment: (taskId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>) => { success: boolean; error?: string; attachment?: Attachment };
  deleteTaskAttachment: (taskId: string, attachmentId: string) => void;
  /** Merge partial organization profile updates (name, logo) from Admin Settings. */
  updateOrganization: (updates: Partial<Organization>) => void;
  updateOrganizationStoragePlan: (plan: StoragePlan) => void;
  updateStorageCaps: (maxFileSizeBytes: number, perUserLimitBytes: number) => void;
  getUserStorageUsed: (userId: string) => number;
  getOrganizationStorageStats: () => { usedBytes: number; limitBytes: number; percent: number; maxFileSizeBytes: number; perUserLimitBytes: number };

  // USER ACTIONS
  createUser: (user: Omit<User, 'id' | 'createdAt' | 'avatarColor' | 'status'>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deactivateUser: (userId: string) => void;
  resendInvitation: (userId: string) => void;
  cancelInvitation: (userId: string) => void;
  activateUser: (userId: string) => void;

  // TEAM ACTIONS
  createTeam: (team: Omit<Team, 'id' | 'createdAt'>) => Team;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  addTeamMember: (teamId: string, userId: string) => void;
  removeTeamMember: (teamId: string, userId: string) => void;

  // PROJECT ACTIONS
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'status'> & { id?: string }) => Project;
  updateProject: (projectId: string, updates: Partial<Project>, currentUserId?: string) => void;
  assignProjectManager: (projectId: string, pmId: string) => void;

  // WORKFLOW ACTIONS
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Workflow;
  updateWorkflow: (workflowId: string, updates: Partial<Workflow>) => void;

  // SPRINT ACTIONS
  createSprint: (sprint: Omit<Sprint, 'id' | 'createdAt'>) => Sprint;
  updateSprintStatus: (sprintId: string, status: SprintStatus) => void;
  assignSprintTeamLeader: (sprintId: string, teamLeaderId: string) => void;
  addSprintMember: (sprintId: string, memberId: string) => void;
  removeSprintMember: (sprintId: string, memberId: string) => void;

  // PROGRAM INCREMENT (PI) ACTIONS — iterations are always created under a PI
  createProgramIncrement: (pi: { projectId: string; number: number }) => ProgramIncrement;
  deleteProgramIncrement: (piId: string) => void;

  // TASK ACTIONS
  createTask: (
    task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'attachments' | 'tags'> & {
      comments?: Comment[];
      attachments?: Attachment[];
      tags?: string[];
    }
  ) => Task;
  updateTaskStatus: (taskId: string, status: TaskStatus, currentUserId: string, resolution?: IssueResolution) => StatusChangeResult;
  updateTask: (taskId: string, updates: Partial<Task>, currentUserId?: string) => StatusChangeResult;
  reorderTasks: (activeTaskId: string, targetTaskId: string, position?: 'before' | 'after') => void;
  moveTask: (taskId: string, updates: Partial<Task>, currentUserId?: string) => StatusChangeResult;
  deleteTask: (taskId: string, deleteChildren?: boolean) => void;
  assignTask: (taskId: string, assigneeId: string, currentUserId: string) => void;
  toggleTaskFlag: (taskId: string, isFlagged: boolean, reason?: string, currentUserId?: string) => void;
  addComment: (taskId: string, userId: string, content: string, attachments?: CommentAttachment[]) => void;
  setIssueStatusOverride: (
    issueId: string,
    status: TaskStatus,
    meta?: IssueOverrideChange
  ) => void;
  setIssueResolutionOverride: (issueId: string, resolution?: IssueResolution, meta?: IssueOverrideChange) => void;
  setIssueAssigneeOverride: (issueId: string, assigneeId: string) => void;
  addIssueComment: (issueId: string, userId: string, content: string, attachments?: CommentAttachment[]) => void;

  // BUG ACTIONS
  createBug: (bug: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>) => Bug;
  updateBugStatus: (bugId: string, status: BugStatus) => void;
  assignBug: (bugId: string, userId: string) => void;

  // TODO ACTIONS
  createTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => Todo;
  updateTodo: (todoId: string, updates: Partial<Todo>) => void;
  toggleTodo: (todoId: string) => void;
  deleteTodo: (todoId: string) => void;

  // NOTIFICATION ACTIONS
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: (userId: string) => void;

  // HELPERS
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  addNotification: (notif: Omit<Notification, 'id'>) => void;

  // RELEASE ACTIONS
  createRelease: (release: Omit<Release, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) => Release;
  updateRelease: (releaseId: string, updates: Partial<Release>) => void;
  deleteRelease: (releaseId: string) => void;

  // DEPENDENCY ACTIONS
  addTaskDependency: (taskId: string, dependsOnTaskId: string, type?: DependencyType, comment?: string) => boolean;
  removeTaskDependency: (dependencyId: string) => void;
  rehydrateIssueLinks: () => void;

  // AUTOMATION ACTIONS
  createAutomationRule: (rule: Omit<AutomationRule, 'id' | 'createdAt'>) => AutomationRule;
  toggleAutomationRule: (ruleId: string) => void;
  deleteAutomationRule: (ruleId: string) => void;

  // SPRINT GOAL UPDATE
  updateSprintGoal: (sprintId: string, goal: string) => void;

  // SPRINT HELPERS
  getNextSprintDates: (projectId: string) => { startDate: string; endDate: string };
  validateSprintOverlap: (projectId: string, startDate: string, endDate: string, excludeSprintId?: string) => boolean;

  // STORY POINTS
  setTaskStoryPoints: (taskId: string, points: number | undefined) => void;

  // TIME TRACKING
  addTimeLog: (taskId: string, userId: string, hours: number, description?: string) => void;
  updateTaskEstimates: (taskId: string, updates: { originalEstimate?: number; remainingEstimate?: number }) => void;

  // EPIC ROLLUP
  getEpicRollup: (epicId: string) => { totalTasks: number; completed: number; inProgress: number; remaining: number; blocked: number; completionPct: number; totalPoints: number; completedPoints: number; remainingPoints: number };

  // OVERDUE DETECTION
  getOverdueTasks: (projectId?: string) => OverdueInfo[];
  isTaskOverdue: (taskId: string) => boolean;

  // SPRINT AUTOMATION
  checkAndAutoStartSprints: () => void;
  checkAndAutoCompleteSprints: () => void;
  handleIncompleteTasks: (sprintId: string, action: SprintIncompleteTaskAction) => void;
  setSprintConfig: (projectId: string, config: Partial<SprintConfig>) => void;

  // AUTOMATION ENGINE
  executeAutomationRule: (ruleId: string, trigger: AutomationTrigger, entity: { type: string; id: string; data?: any }, depth?: number, chain?: string[]) => void;
  checkAndExecuteAutomations: (trigger: AutomationTrigger, entity: { type: string; id: string; data?: any }) => void;

  // BULK OPERATIONS
  toggleBulkSelect: (taskId: string) => void;
  selectAllTasks: (taskIds: string[]) => void;
  clearBulkSelection: () => void;
  bulkUpdateStatus: (status: TaskStatus) => { updated: number; refused: number };
  bulkUpdatePriority: (priority: Priority) => void;
  bulkAssignUser: (userId: string) => void;
  bulkAssignTeam: (teamId: string) => void;
  bulkMoveSprint: (sprintId: string | undefined) => void;
  bulkAssignRelease: (releaseId: string | undefined) => void;
  bulkDeleteTasks: () => void;

  // INITIATIVE
  createInitiative: (initiative: Omit<Initiative, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) => Initiative;
  updateInitiative: (initiativeId: string, updates: Partial<Initiative>) => void;
  deleteInitiative: (initiativeId: string) => void;

  // CUSTOM FIELDS
  createCustomField: (field: Omit<CustomFieldDefinition, 'id' | 'createdAt'>) => CustomFieldDefinition;
  updateCustomField: (fieldId: string, updates: Partial<CustomFieldDefinition>) => void;
  deleteCustomField: (fieldId: string) => void;
  setTaskCustomFieldValue: (taskId: string, fieldId: string, value: any) => void;

  // SAVED FILTERS
  saveFilter: (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => SavedFilter;
  deleteFilter: (filterId: string) => void;

  // SCENARIO
  createScenario: (scenario: Omit<Scenario, 'id' | 'createdAt' | 'changes'>) => Scenario;
  addScenarioChange: (scenarioId: string, change: ScenarioChange) => void;
  applyScenario: (scenarioId: string) => void;
  deleteScenario: (scenarioId: string) => void;

  // ADVANCED SEARCH
  searchTasks: (projectId: string, filters: EnhancedFilterState) => Task[];

  // EXPORT
  exportTasksCSV: (projectId: string) => string;
  exportSprintReportCSV: (sprintId: string) => string;
  exportRoadmapCSV: (projectId: string) => string;
  exportReleaseCSV: (releaseId: string) => string;
  exportProjectReportPDF: (projectId: string) => string;

  // APPROVALS
  requestApproval: (taskId: string, approverId: string) => void;
  approveTask: (taskId: string, approverId: string, comment?: string) => void;
  rejectTask: (taskId: string, approverId: string, comment?: string) => void;
  getTaskApprovals: (taskId: string) => Approval[];

  // LIVE TIMER
  startTimer: (taskId: string, userId: string, projectId: string) => void;
  stopTimer: () => void;
  getTimerElapsed: () => number;
  restoreTimer: () => void;

  // DELETE ACTIONS
  deleteSprint: (sprintId: string) => void;
  deleteProject: (projectId: string) => void;
  deleteTeam: (teamId: string) => void;
  deleteWorkflow: (workflowId: string) => void;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => void;

  // SPRINT RETROSPECTIVE
  retrospectives: SprintRetrospective[];
  retrospectiveItems: RetrospectiveItem[];
  getSprintRetrospective: (sprintId: string) => SprintRetrospective | undefined;
  getRetrospectiveItems: (sprintId: string) => RetrospectiveItem[];
  addRetroItem: (item: Omit<RetrospectiveItem, 'id' | 'createdAt' | 'votes'>) => RetrospectiveItem;
  updateRetroItem: (itemId: string, content: string) => void;
  deleteRetroItem: (itemId: string) => void;
  voteRetroItem: (itemId: string, userId: string) => void;
  updateRetroActionItem: (itemId: string, updates: Partial<RetrospectiveItem>) => void;
  convertRetroActionToTask: (itemId: string, projectId: string, title: string, assigneeId?: string) => Task;
  updateSprintRetrospective: (sprintId: string, updates: Partial<SprintRetrospective>) => void;

  // CROSS-PROJECT SPRINT LINKS
  sprintLinks: SprintLink[];
  linkSprints: (sourceSprintId: string, targetSprintId: string, relationship: SprintLinkRelationship, currentUserId?: string) => SprintLink;
  removeSprintLink: (linkId: string) => void;
  getSprintLinks: (sprintId: string) => Array<{
    link: SprintLink;
    otherSprint: Sprint;
    otherProject: Project;
    direction: 'outgoing' | 'incoming';
    isBlocked: boolean;
  }>;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const avatarColors = ['#2563eb', '#7c3aed', '#0f766e', '#be185d', '#d97706', '#059669', '#0891b2', '#172554'];

const buildInitialTodos = (): Todo[] => {
  const list: Todo[] = initTodos.map((t) => ({ ...t, source: 'PERSONAL' as const }));
  initTasks.forEach((task) => {
    if (task.assigneeId && !list.some((t) => t.taskId === task.id && t.userId === task.assigneeId)) {
      const proj = initProjects.find((p) => p.id === task.projectId);
      const isCompleted = task.status === 'DONE';
      list.push({
        id: `todo-assigned-${task.id}`,
        userId: task.assigneeId,
        title: task.title,
        notes: task.description
          ? `[Project: ${proj?.name || 'Project'}] ${task.description}`
          : `Assigned task from ${proj?.name || 'Project'}`,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : undefined,
        completed: isCompleted,
        completedAt: isCompleted ? (task.completedAt || new Date().toISOString()) : undefined,
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString(),
        taskId: task.id,
        projectId: task.projectId,
        source: 'ASSIGNED',
        assignedById: task.createdById || task.teamLeaderId,
      });
    }
  });
  return list;
};

const syncTaskToUserTodo = (
  todos: Todo[],
  task: Task,
  projects: Project[],
  users: User[],
  assignedById?: string,
  prevAssigneeId?: string
): Todo[] => {
  let updatedTodos = [...todos];

  // If task was reassigned from a previous user, remove old assigned todo for that user
  if (prevAssigneeId && prevAssigneeId !== task.assigneeId) {
    updatedTodos = updatedTodos.filter(
      (t) => !(t.taskId === task.id && t.userId === prevAssigneeId)
    );
  }

  // If no assignee now, nothing to add
  if (!task.assigneeId) {
    return updatedTodos;
  }

  const proj = projects.find((p) => p.id === task.projectId);
  const assigner = assignedById ? users.find((u) => u.id === assignedById) : undefined;
  const isDone = task.status === 'DONE';
  const dueDate = task.dueDate ? task.dueDate.split('T')[0] : undefined;

  const existingIdx = updatedTodos.findIndex(
    (t) => t.taskId === task.id && t.userId === task.assigneeId
  );

  const notes = task.description
    ? `[Project: ${proj?.name || 'Project'}${assigner ? ` | Assigned by: ${assigner.name}` : ''}] ${task.description}`
    : `Assigned task from ${proj?.name || 'Project'}${assigner ? ` by ${assigner.name}` : ''}`;

  if (existingIdx >= 0) {
    const existing = updatedTodos[existingIdx];
    updatedTodos[existingIdx] = {
      ...existing,
      title: task.title,
      notes: notes,
      priority: task.priority,
      dueDate: dueDate,
      completed: isDone,
      completedAt: isDone ? (existing.completedAt || new Date().toISOString()) : undefined,
      updatedAt: new Date().toISOString(),
      projectId: task.projectId,
      assignedById: assignedById || existing.assignedById,
      source: 'ASSIGNED',
    };
  } else {
    updatedTodos.unshift({
      id: `todo-assigned-${task.id}-${Date.now()}`,
      userId: task.assigneeId,
      title: task.title,
      notes: notes,
      priority: task.priority,
      dueDate: dueDate,
      completed: isDone,
      completedAt: isDone ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskId: task.id,
      projectId: task.projectId,
      source: 'ASSIGNED',
      assignedById: assignedById || task.createdById,
    });
  }

  return updatedTodos;
};

/**
 * Transition-history list for a task whose status is about to change.
 *
 * Returns the existing list reference unchanged when the *displayed* status is
 * not actually changing, so a no-op write (an edit that re-saves the current
 * status) never fabricates a record. The displayed status is CANCELLED while
 * the issue carries a CANCELLED resolution — a cancellation must be recorded
 * as CANCELLED, never as DONE. `sourceEnteredAt` is the previous transition's
 * timestamp, or the task's creation when this is the first recorded change -
 * which is what makes every "Time In Source Status" value recomputed from real
 * timestamps. Changes without a user context (automations, bulk jobs) fall
 * back to the "System" actor.
 */
const nextStatusTransitions = (
  prevTask: Task,
  nextStatus: TaskStatus,
  userId: string,
  users: User[],
  nextResolution?: IssueResolution
): StatusTransition[] | undefined => {
  const fromStatus: TransitionStatus = prevTask.resolution === 'CANCELLED' ? 'CANCELLED' : prevTask.status;
  const toStatus: TransitionStatus = nextResolution === 'CANCELLED' ? 'CANCELLED' : nextStatus;
  if (fromStatus === toStatus) return prevTask.statusTransitions;
  const history = prevTask.statusTransitions || [];
  const last = history.length > 0 ? history[history.length - 1] : undefined;
  const actor = userId ? users.find((u) => u.id === userId) : undefined;
  return [
    ...history,
    buildStatusTransition({
      fromStatus,
      toStatus,
      sourceEnteredAt: last ? last.changedAt : prevTask.createdAt,
      actor: actor
        ? { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl, avatarColor: actor.avatarColor }
        : { id: userId || 'system' },
    }),
  ];
};

/**
 * Structured member mentions inside comment HTML (`span[data-mention-id]`),
 * stored on the comment so mention state is part of the model, not just markup.
 */
const mentionIdsFromHtml = (content: string): string[] | undefined => {
  const ids = new Set<string>();
  const re = /data-mention-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return ids.size > 0 ? Array.from(ids) : undefined;
};

// Custom fields: no demo/seed definitions — the Details section starts with
// core fields only. Hydrate the persisted snapshot (Admin/PM-created
// definitions + per-issue values from localStorage) so issue-specific custom
// fields survive a page refresh; legacy pre-seeded fields are dropped during
// hydration. See utils/customFieldPersistence.
const hydratedCustomFields = applyCustomFieldSnapshot(
  SEED_CUSTOM_FIELD_DEFINITIONS,
  initTasks,
  readCustomFieldSnapshot()
);

export const useAppStore = create<AppState>()((set, get) => ({
  organization: initOrganization,
  users: initUsers,
  teams: initTeams,
  // Replay persisted identity overrides (rename/rekey) onto the seed data so
  // identity changes survive a refresh — see utils/projectIdentityPersistence.
  projects: applyProjectIdentityOverrides(initProjects),
  workflows: initWorkflows,
  sprints: initSprints,
  pis: initProgramIncrements,
  tasks: hydratedCustomFields.tasks,
  bugs: initBugs,
  todos: buildInitialTodos(),
  notifications: initNotifications,
  activities: initActivities,
  retrospectives: initRetrospectives,
  retrospectiveItems: initRetroItems,
  sprintLinks: initSprintLinks,
  releases: [
    {
      id: 'rel-001', projectId: 'proj-001', name: 'v1.0 MVP', version: '1.0.0',
      description: 'Initial MVP release with core e-commerce features',
      startDate: '2024-07-01', targetDate: '2024-09-30', status: 'IN_PROGRESS',
      taskIds: ['task-001', 'task-002', 'task-003'], epicIds: ['epic-001'],
      progress: 42, createdById: 'u-pm-01',
      createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-09-05T00:00:00Z',
    },
    {
      id: 'rel-002', projectId: 'proj-001', name: 'v1.1 Payments', version: '1.1.0',
      description: 'Payment integration and order management',
      startDate: '2024-10-01', targetDate: '2024-12-31', status: 'PLANNING',
      taskIds: [], epicIds: [],
      progress: 0, createdById: 'u-pm-01',
      createdAt: '2024-09-05T00:00:00Z', updatedAt: '2024-09-05T00:00:00Z',
    },
    {
      id: 'rel-003', projectId: 'proj-002', name: 'v1.0 Core', version: '1.0.0',
      description: 'Core hospital management modules',
      startDate: '2024-06-01', targetDate: '2024-12-31', status: 'IN_PROGRESS',
      taskIds: ['task-012', 'task-013'], epicIds: [],
      progress: 28, createdById: 'u-pm-02',
      createdAt: '2024-05-20T00:00:00Z', updatedAt: '2024-09-03T00:00:00Z',
    },
  ],
  taskDependencies: [
    { id: 'dep-001', taskId: 'task-003', dependsOnTaskId: 'task-002', type: 'BLOCKS', createdAt: '2024-09-01T00:00:00Z' },
    { id: 'dep-002', taskId: 'task-010', dependsOnTaskId: 'task-002', type: 'BLOCKS', createdAt: '2024-09-03T00:00:00Z' },
    { id: 'dep-003', taskId: 'story-033', dependsOnTaskId: 'task-034', type: 'RELATES_TO', createdAt: '2026-09-16T09:00:00Z' },
    { id: 'dep-004', taskId: 'feat-036', dependsOnTaskId: 'feat-031', type: 'BLOCKS', createdAt: '2026-09-18T10:00:00Z' },
    { id: 'dep-005', taskId: 'epic-032', dependsOnTaskId: 'feat-036', type: 'MENTIONED_IN', createdAt: '2026-09-20T10:00:00Z' },
  ],
  automationRules: [
    {
      id: 'auto-001', projectId: 'proj-001', name: 'Auto-update progress on task done',
      description: 'When a task is marked done, update iteration and project progress',
      trigger: 'TASK_DONE', conditions: [], actions: ['UPDATE_SPRINT_PROGRESS', 'UPDATE_PROJECT_PROGRESS'],
      enabled: true, executionCount: 0, createdAt: '2024-07-01T00:00:00Z',
    },
    {
      id: 'auto-002', projectId: 'proj-001', name: 'Notify on overdue tasks',
      description: 'When a task becomes overdue, notify the assignee and team leader',
      trigger: 'TASK_OVERDUE', conditions: [], actions: ['NOTIFY_ASSIGNEE', 'NOTIFY_TEAM_LEAD'],
      enabled: true, executionCount: 0, createdAt: '2024-07-01T00:00:00Z',
    },
  ],
  automationExecutions: [],
  initiatives: [
    {
      id: 'init-001', projectId: 'proj-001', name: 'Digital Commerce Transformation',
      description: 'Complete digital commerce platform with web, mobile, and API channels',
      status: 'IN_PROGRESS', startDate: '2024-07-01', targetDate: '2024-12-31',
      epicIds: ['epic-001', 'epic-002'], progress: 42,
      createdById: 'u-pm-01', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-09-05T00:00:00Z',
    },
  ],
  customFieldDefinitions: hydratedCustomFields.definitions,
  savedFilters: [],
  scenarios: [],
  sprintConfigs: {
    'proj-001': { projectId: 'proj-001', incompleteTaskAction: 'MOVE_TO_NEXT_SPRINT', updatedAt: '2024-07-01T00:00:00Z' },
  },
  bulkSelectedTaskIds: [],
  issueStatusOverrides: {},
  issueResolutions: {},
  issueComments: {},
  issueStatusTransitions: {},
  issueStatusEnteredAt: {},
  issueAssigneeOverrides: {},
  approvals: [],
  activeTimer: null,
  fileRecords: [
    {
      id: 'fr-001', organizationId: 'org-001', projectId: 'proj-001', taskId: 'task-001',
      uploadedById: 'u-pm-01', fileName: 'ecommerce-architecture-v2.pdf', originalFileName: 'ecommerce-architecture-v2.pdf',
      fileUrl: '/storage/org-001/proj-001/fr-001/ecommerce-architecture-v2.pdf',
      fileSize: 2457600, mimeType: 'application/pdf', checksum: 'abc123',
      version: 2, versionGroupId: 'vg-001', isLatestVersion: true, isDeleted: false,
      createdAt: '2024-08-20T10:30:00Z', updatedAt: '2024-08-20T10:30:00Z',
    },
    {
      id: 'fr-002', organizationId: 'org-001', projectId: 'proj-001', taskId: 'task-001',
      uploadedById: 'u-tl-01', fileName: 'ecommerce-architecture.pdf', originalFileName: 'ecommerce-architecture.pdf',
      fileUrl: '/storage/org-001/proj-001/fr-002/ecommerce-architecture.pdf',
      fileSize: 1843200, mimeType: 'application/pdf', checksum: 'def456',
      version: 1, versionGroupId: 'vg-001', isLatestVersion: false, isDeleted: false,
      createdAt: '2024-08-15T14:00:00Z', updatedAt: '2024-08-15T14:00:00Z',
    },
    {
      id: 'fr-003', organizationId: 'org-001', projectId: 'proj-001', taskId: 'task-002',
      uploadedById: 'u-member-01', fileName: 'ui-wireframes.png', originalFileName: 'ui-wireframes.png',
      fileUrl: '/storage/org-001/proj-001/fr-003/ui-wireframes.png',
      fileSize: 524288, mimeType: 'image/png', checksum: 'ghi789',
      version: 1, versionGroupId: 'vg-002', isLatestVersion: true, isDeleted: false,
      createdAt: '2024-09-01T09:15:00Z', updatedAt: '2024-09-01T09:15:00Z',
    },
    {
      id: 'fr-004', organizationId: 'org-001', projectId: 'proj-001', taskId: 'task-003',
      uploadedById: 'u-pm-01', fileName: 'sprint-velocity-report.xlsx', originalFileName: 'sprint-velocity-report.xlsx',
      fileUrl: '/storage/org-001/proj-001/fr-004/sprint-velocity-report.xlsx',
      fileSize: 102400, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      checksum: 'jkl012', version: 1, versionGroupId: 'vg-003', isLatestVersion: true, isDeleted: false,
      createdAt: '2024-09-03T16:45:00Z', updatedAt: '2024-09-03T16:45:00Z',
    },
  ],

  // ---- FILE ACTIONS ----
  addFileRecord: (record) => {
    const now = new Date().toISOString();
    const newRecord: FileRecord = {
      ...record,
      id: `fr-${generateId()}`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ fileRecords: [...s.fileRecords, newRecord] }));
    return newRecord;
  },

  removeFileRecord: (fileId, userId) => {
    const now = new Date().toISOString();
    set((s) => ({
      fileRecords: s.fileRecords.map((fr) =>
        fr.id === fileId ? { ...fr, isDeleted: true, deletedAt: now, deletedById: userId, updatedAt: now } : fr
      ),
    }));
  },

  getFileRecordsForTask: (taskId) => {
    return get().fileRecords.filter((fr) => fr.taskId === taskId && !fr.isDeleted);
  },

  getFileRecordsForBug: (bugId) => {
    return get().fileRecords.filter((fr) => fr.bugId === bugId && !fr.isDeleted);
  },

  getFileVersions: (versionGroupId) => {
    return get().fileRecords
      .filter((fr) => fr.versionGroupId === versionGroupId && !fr.isDeleted)
      .sort((a, b) => b.version - a.version);
  },

  getStorageUsage: (projectId) => {
    const projectFiles = get().fileRecords.filter((fr) => fr.projectId === projectId && !fr.isDeleted);
    const projectUsedBytes = projectFiles.reduce((sum, fr) => sum + fr.fileSize, 0);
    return {
      usedBytes: projectUsedBytes,
      quotaBytes: 51200 * 1024 * 1024,
      projectUsedBytes,
      projectQuotaBytes: 10 * 1024 * 1024 * 1024,
    };
  },

  // ---- USER ----
  createUser: (userData) => {
    const newUser: User = {
      ...userData,
      id: `u-new-${generateId()}`,
      status: 'INVITATION_PENDING',
      avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ users: [...s.users, newUser] }));
    get().addActivity({
      organizationId: 'org-001',
      userId: 'u-admin-01',
      action: 'created user account',
      entityType: 'USER',
      entityId: newUser.id,
      entityTitle: newUser.name,
      createdAt: new Date().toISOString(),
    });
    return newUser;
  },

  updateUser: (userId, updates) => {
    set((s) => ({ users: s.users.map((u) => u.id === userId ? { ...u, ...updates } : u) }));
  },

  deactivateUser: (userId) => {
    set((s) => ({
      users: s.users.map((u) => u.id === userId ? { ...u, status: 'INACTIVE' as UserStatus } : u),
    }));
  },

  resendInvitation: (userId) => {
    // In a real app would call API. Here just trigger a notification.
    const user = get().users.find((u) => u.id === userId);
    if (user) {
      get().addActivity({
        organizationId: 'org-001',
        userId: 'u-admin-01',
        action: 'resent invitation to',
        entityType: 'USER',
        entityId: userId,
        entityTitle: user.name,
        createdAt: new Date().toISOString(),
      });
    }
  },

  cancelInvitation: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    set((s) => ({ users: s.users.filter((u) => u.id !== userId) }));
    if (user) {
      get().addActivity({
        organizationId: 'org-001',
        userId: 'u-admin-01',
        action: 'cancelled invitation for',
        entityType: 'USER',
        entityId: userId,
        entityTitle: user.name,
        createdAt: new Date().toISOString(),
      });
    }
  },

  activateUser: (userId) => {
    set((s) => ({
      users: s.users.map((u) => u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus } : u),
    }));
  },

  // ---- TEAM ----
  createTeam: (teamData) => {
    const newTeam: Team = {
      ...teamData,
      id: `team-${generateId()}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ teams: [...s.teams, newTeam] }));
    return newTeam;
  },

  updateTeam: (teamId, updates) => {
    set((s) => ({ teams: s.teams.map((t) => t.id === teamId ? { ...t, ...updates } : t) }));
  },

  addTeamMember: (teamId, userId) => {
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId && !t.memberIds.includes(userId)
          ? { ...t, memberIds: [...t.memberIds, userId] }
          : t
      ),
      users: s.users.map((u) => u.id === userId ? { ...u, teamId } : u),
    }));
  },

  removeTeamMember: (teamId, userId) => {
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t
      ),
    }));
  },

  // ---- PROJECT ----
  createProject: (projectData) => {
    const existingProjects = get().projects;
    const finalId = (projectData.id && projectData.id.trim())
      ? projectData.id.trim()
      : `proj-${String(existingProjects.length + 1).padStart(3, '0')}`;

    const finalKey = (projectData.key && projectData.key.trim())
      ? projectData.key.trim().toUpperCase()
      : (projectData.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'PROJ').toUpperCase();

    const finalCategory = (projectData.category && projectData.category.trim())
      ? projectData.category.trim()
      : 'Software Development';

    const newProject: Project = {
      ...projectData,
      id: finalId,
      key: finalKey,
      category: finalCategory,
      status: 'PLANNING',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ projects: [...s.projects, newProject] }));
    get().addActivity({
      organizationId: 'org-001',
      userId: projectData.createdByAdminId,
      action: 'created project',
      entityType: 'PROJECT',
      entityId: newProject.id,
      entityTitle: newProject.name,
      createdAt: new Date().toISOString(),
    });
    get().addNotification({
      userId: newProject.projectManagerId,
      type: 'PROJECT_ASSIGNED',
      title: 'Project Assigned',
      message: `You have been assigned as Project Manager for "${newProject.name}".`,
      read: false,
      relatedEntityId: newProject.id,
      relatedEntityType: 'PROJECT',
      createdAt: new Date().toISOString(),
    });
    return newProject;
  },

  updateProject: (projectId, updates, currentUserId) => {
    const prev = get().projects.find((p) => p.id === projectId);

    // Normalize identity fields ONCE so the stored project, the persisted
    // identity override and the audit entries can never disagree on
    // casing/whitespace (modals already normalize; this is the last line).
    const normalized: Partial<Project> = { ...updates };
    if (normalized.name !== undefined) normalized.name = normalizeProjectName(normalized.name);
    if (typeof normalized.key === 'string') normalized.key = normalized.key.trim().toUpperCase();

    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, ...normalized, updatedAt: new Date().toISOString() } : p
      ),
    }));
    if (!prev) return;

    const nextKey =
      normalized.key !== undefined
        ? normalized.key
        : (prev.key || '').trim().toUpperCase();
    const prevKey = (prev.key || '').trim().toUpperCase();
    const keyChanged = Boolean(nextKey) && nextKey !== prevKey;

    const nextName = normalized.name !== undefined ? normalized.name : '';
    const nameChanged = Boolean(nextName) && nextName !== prev.name;

    // ---- Persist identity so a rename/rekey survives a refresh ----
    // Stored per immutable project id (name + key together as one snapshot);
    // removed again when both values are back to their seed state.
    if (nameChanged || keyChanged) {
      saveProjectIdentityOverride(
        projectId,
        { name: nextName || normalizeProjectName(prev.name), key: nextKey || prevKey },
        initProjects
      );
    }

    // ---- Identity change: keep every reference in sync, immediately ----
    if (keyChanged) {
      const prevPrefix = deriveIssueKeyPrefix(prevKey);
      const nextPrefix = deriveIssueKeyPrefix(nextKey);

      if (prevPrefix && nextPrefix && prevPrefix !== nextPrefix) {
        set((s) => ({
          // Issue keys: prefix re-issued, numeric part untouched (ECOMM-500 -> WEBCORM-500).
          tasks: s.tasks.map((t) =>
            t.projectId === projectId && t.issueKey
              ? { ...t, issueKey: rekeyIssueKey(nextPrefix, t.issueKey) }
              : t
          ),
          // Iteration names that embed the old prefix ("ECOMM 4.0" and
          // digit-adjacent "ECOMM3.5") — token-aware replacement that never
          // touches longer words/keys ("ECOMMERCE") or other projects.
          sprints: s.sprints.map((sp) => {
            if (sp.projectId !== projectId) return sp;
            const name = rekeyPrefixInText(sp.name, prevPrefix, nextPrefix);
            return name === sp.name ? sp : { ...sp, name };
          }),
          // Project-scoped notifications only (relatedEntityId === projectId):
          // rekey any embedded issue prefixes while preserving ids, read
          // state and timestamps. Other projects' notifications are never
          // touched; notifications scoped to a sprint/task stay historical.
          notifications: s.notifications.map((n) => {
            if (n.relatedEntityId !== projectId) return n;
            const title = rekeyPrefixInText(n.title, prevPrefix, nextPrefix);
            const message = rekeyPrefixInText(n.message, prevPrefix, nextPrefix);
            return title === n.title && message === n.message ? n : { ...n, title, message };
          }),
        }));
        rekeyPersistedIssueLinks(projectId, prevPrefix, nextPrefix);
      }
    }

    // ---- Rename: denormalized project name references (audit, notifications) ----
    if (nameChanged) {
      set((s) => ({
        // PROJECT activities denormalize the project's current name — but
        // identity-change activities (rename/rekey audit entries) are
        // historical records and keep the values from when they were written.
        activities: s.activities.map((a) =>
          a.entityType === 'PROJECT' && a.entityId === projectId && !a.metadata?.identityChange
            ? { ...a, entityTitle: nextName }
            : a
        ),
        // Strictly this project's notifications: never select by
        // relatedEntityType alone, and replace whole-name tokens only so
        // short/overlapping names cannot corrupt unrelated text.
        notifications: s.notifications.map((n) => {
          if (n.relatedEntityId !== projectId) return n;
          const title = replaceProjectNameInText(n.title, prev.name, nextName);
          const message = replaceProjectNameInText(n.message, prev.name, nextName);
          return title === n.title && message === n.message ? n : { ...n, title, message };
        }),
      }));
    }

    // ---- Audit: exactly one entry per identity field that actually changed ----
    if (nameChanged || keyChanged) {
      const createdAt = new Date().toISOString();
      const auditBase = {
        organizationId: 'org-001',
        userId: currentUserId || 'system',
        entityType: 'PROJECT',
        entityId: projectId,
        createdAt,
      };
      if (nameChanged) {
        get().addActivity({
          ...auditBase,
          action: `renamed project from "${prev.name}" to`,
          entityTitle: nextName,
          metadata: { identityChange: 'name' },
        });
      }
      if (keyChanged) {
        get().addActivity({
          ...auditBase,
          action: `changed project key from "${prevKey}" to`,
          entityTitle: nextKey,
          metadata: { identityChange: 'key' },
        });
      }
    }
  },

  assignProjectManager: (projectId, pmId) => {
    get().updateProject(projectId, { projectManagerId: pmId });
  },

  // ---- WORKFLOW ----
  createWorkflow: (workflowData) => {
    const newWorkflow: Workflow = {
      ...workflowData,
      id: workflowData.id || `wf-${generateId()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ workflows: [...s.workflows, newWorkflow] }));
    return newWorkflow;
  },

  updateWorkflow: (workflowId, updates) => {
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === workflowId ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      ),
    }));
  },

  // ---- PROGRAM INCREMENT (PI) ----
  createProgramIncrement: ({ projectId, number }) => {
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('PI number must be a positive whole number');
    }
    if (get().pis.some((p) => p.projectId === projectId && p.number === number)) {
      throw new Error(`PI ${number} already exists for this project`);
    }
    const newPi: ProgramIncrement = {
      id: `pi-${generateId()}`,
      projectId,
      number,
      name: `PI ${number}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ pis: [...s.pis, newPi] }));
    return newPi;
  },

  deleteProgramIncrement: (piId: string) => {
    const children = get().sprints.filter((sp) => sp.piId === piId);
    if (children.length > 0) {
      throw new Error(
        `PI still has ${children.length} iteration${children.length === 1 ? '' : 's'} — remove or reassign them first`
      );
    }
    set((s) => ({ pis: s.pis.filter((p) => p.id !== piId) }));
  },

  // ---- SPRINT ----
  createSprint: (sprintData) => {
    // An iteration must always belong to a PI (Project → PI → Iteration).
    if (!sprintData.piId) {
      throw new Error('Iteration must belong to a PI');
    }
    if (!get().pis.some((p) => p.id === sprintData.piId)) {
      throw new Error('Parent PI does not exist');
    }

    // Caller-provided dates win; fall back to the cadence defaults so no flow
    // ever writes hardcoded dates.
    const nextDates = get().getNextSprintDates(sprintData.projectId);
    const startDate = sprintData.startDate || nextDates.startDate;
    const endDate = sprintData.endDate || nextDates.endDate;

    // Validate no overlap
    if (get().validateSprintOverlap(sprintData.projectId, startDate, endDate)) {
      throw new Error('Sprint overlaps with an existing sprint');
    }

    const newSprint: Sprint = {
      ...sprintData,
      id: `spr-${generateId()}`,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ sprints: [...s.sprints, newSprint] }));
    return newSprint;
  },

  updateSprintStatus: (sprintId, status) => {
    set((s) => ({
      sprints: s.sprints.map((sp) => sp.id === sprintId ? { ...sp, status } : sp),
    }));
    const sprint = get().sprints.find((s) => s.id === sprintId);
    if (sprint) {
      get().addActivity({
        organizationId: 'org-001',
        userId: sprint.createdById,
        action: status === 'ACTIVE' ? 'started sprint' : 'completed sprint',
        entityType: 'SPRINT',
        entityId: sprintId,
        entityTitle: sprint.name,
        createdAt: new Date().toISOString(),
      });
    }
  },

  assignSprintTeamLeader: (sprintId, teamLeaderId) => {
    set((s) => ({
      sprints: s.sprints.map((sp) =>
        sp.id === sprintId ? { ...sp, teamLeaderId } : sp
      ),
    }));
    const sprint = get().sprints.find((s) => s.id === sprintId);
    const tl = get().users.find((u) => u.id === teamLeaderId);
    if (sprint && tl) {
      get().addActivity({
        organizationId: 'org-001',
        userId: sprint.createdById,
        action: 'assigned Team Leader to sprint',
        entityType: 'SPRINT',
        entityId: sprintId,
        entityTitle: `${sprint.name} → ${tl.name}`,
        createdAt: new Date().toISOString(),
      });
      get().addNotification({
        userId: teamLeaderId,
        type: 'PROJECT_ASSIGNED',
        title: 'Iteration Assigned',
        message: `You have been assigned as Team Leader for iteration "${sprint.name}".`,
        read: false,
        relatedEntityId: sprintId,
        relatedEntityType: 'SPRINT',
        createdAt: new Date().toISOString(),
      });
    }
  },

  addSprintMember: (sprintId, memberId) => {
    set((s) => ({
      sprints: s.sprints.map((sp) =>
        sp.id === sprintId
          ? { ...sp, memberIds: [...(sp.memberIds || []).filter((id) => id !== memberId), memberId] }
          : sp
      ),
    }));
  },

  removeSprintMember: (sprintId, memberId) => {
    set((s) => ({
      sprints: s.sprints.map((sp) =>
        sp.id === sprintId
          ? { ...sp, memberIds: (sp.memberIds || []).filter((id) => id !== memberId) }
          : sp
      ),
    }));
  },

  // ---- TASK ----
  createTask: (taskData) => {
    // Real Jira-style key for the new issue — derived from its content, never
    // from the internal id, so it stays stable across reloads.
    const project = get().projects.find((p) => p.id === taskData.projectId);
    const occupied = new Set(
      get()
        .tasks.filter((t) => t.projectId === taskData.projectId)
        .map((t) => getIssueKey(project, t))
    );
    const newTask: Task = {
      ...taskData,
      id: `task-${generateId()}`,
      // An Initiative always enters the Initiative workflow at Backlog — the
      // creation flow never trusts a caller-supplied status. The resume marker
      // only exists while an Initiative is On Hold, never at creation.
      status: taskData.type === 'INITIATIVE' ? 'BACKLOG' : taskData.status,
      initiativePreviousStatus:
        taskData.type === 'INITIATIVE' ? undefined : taskData.initiativePreviousStatus,
      issueKey:
        taskData.issueKey ??
        mintIssueKey(getIssueKeyPrefix(project), occupied, `${taskData.type}:${taskData.title}`),
      // Seed data (materialised sprint issues) may arrive with existing comments,
      // attachments and tags — they must survive creation, not be wiped.
      tags: taskData.tags ?? [],
      comments: taskData.comments ?? [],
      attachments: taskData.attachments ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Automatically add to assignee's to-do list if assigned
    let nextTodos = get().todos;
    if (newTask.assigneeId) {
      nextTodos = syncTaskToUserTodo(
        nextTodos,
        newTask,
        get().projects,
        get().users,
        taskData.createdById
      );
    }

    set((s) => ({ tasks: [...s.tasks, newTask], todos: nextTodos }));

    if (newTask.assigneeId) {
      get().addNotification({
        userId: newTask.assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `You have been assigned: "${newTask.title}". Added to your To-Do list.`,
        read: false,
        relatedEntityId: newTask.id,
        relatedEntityType: 'TASK',
        createdAt: new Date().toISOString(),
      });
    }
    get().addActivity({
      organizationId: 'org-001',
      userId: taskData.createdById,
      action: 'created task',
      entityType: 'TASK',
      entityId: newTask.id,
      entityTitle: newTask.title,
      createdAt: new Date().toISOString(),
    });
    // Trigger automations
    get().checkAndExecuteAutomations('TASK_CREATED', { type: 'TASK', id: newTask.id });
    if (newTask.assigneeId) {
      get().checkAndExecuteAutomations('TASK_ASSIGNED', { type: 'TASK', id: newTask.id });
    }
    return newTask;
  },

  updateTaskStatus: (taskId, status, currentUserId, resolution) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    if (!prevTask) return { ok: false, reason: 'Work item not found.' };

    // Initiative workflow gate: every status change on an INITIATIVE must obey
    // the centralised rules (one chain step, On Hold entry/exit, Completed
    // terminal). Illegal moves are refused without crashing callers —
    // automations, bulk operations and todo sync all flow through here.
    let initiativeGate: InitiativeStatusChange | undefined;
    if (prevTask.type === 'INITIATIVE' && status !== prevTask.status) {
      initiativeGate = evaluateInitiativeStatusChange(prevTask, status);
      if (!initiativeGate.allowed) {
        console.warn(
          `[initiative-workflow] Refused ${prevTask.status} -> ${status} on "${prevTask.title}" — not a legal Initiative transition.`
        );
        return {
          ok: false,
          reason: explainInitiativeTransition(prevTask.status, status, prevTask.initiativePreviousStatus),
        };
      }
    }

    const transitions = prevTask
      ? nextStatusTransitions(prevTask, status, currentUserId, get().users, resolution)
      : undefined;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              // Enter On Hold: store the resume target. Resume/chain move: clear it.
              ...(initiativeGate
                ? { initiativePreviousStatus: initiativeGate.initiativePreviousStatus }
                : {}),
              updatedAt: new Date().toISOString(),
              completedAt: status === 'DONE' ? new Date().toISOString() : t.completedAt,
              ...(resolution !== undefined
                ? {
                    resolution,
                    resolvedAt: resolution ? new Date().toISOString() : undefined,
                  }
                : {}),
              ...(transitions && transitions !== t.statusTransitions
                ? { statusTransitions: transitions }
                : {}),
            }
          : t
      ),
      todos: s.todos.map((td) =>
        td.taskId === taskId
          ? {
              ...td,
              completed: status === 'DONE',
              completedAt: status === 'DONE' ? (td.completedAt || new Date().toISOString()) : undefined,
              updatedAt: new Date().toISOString(),
            }
          : td
      ),
    }));
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) {
      get().addActivity({
        organizationId: 'org-001',
        userId: currentUserId,
        action: `updated status to ${status.replace(/_/g, ' ')}`,
        entityType: 'TASK',
        entityId: taskId,
        entityTitle: task.title,
        createdAt: new Date().toISOString(),
      });
      // Update project progress
      const allProjectTasks = get().tasks.filter((t) => t.projectId === task.projectId);
      const doneTasks = allProjectTasks.filter((t) => t.status === 'DONE').length;
      const progress = Math.round((doneTasks / allProjectTasks.length) * 100);
      get().updateProject(task.projectId, { progress });
      // Trigger automations
      get().checkAndExecuteAutomations('TASK_STATUS_CHANGED', { type: 'TASK', id: taskId, data: { status } });
      if (status === 'DONE') {
        get().checkAndExecuteAutomations('TASK_DONE', { type: 'TASK', id: taskId });
      }
    }
    return { ok: true };
  },

  updateTask: (taskId, updates, currentUserId) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    if (!prevTask) return { ok: false, reason: 'Work item not found.' };

    // Converting any work item into an INITIATIVE re-enters the workflow at
    // Backlog: a generic status (In Progress, Done, ...) must never carry over
    // and pre-complete a freshly created Initiative.
    let statusRefused = false;
    let statusReason: string | undefined;
    let gatedUpdates = updates;
    if (prevTask.type !== 'INITIATIVE' && updates.type === 'INITIATIVE') {
      gatedUpdates = {
        ...updates,
        status: 'BACKLOG',
        initiativePreviousStatus: undefined,
        resolution: undefined,
        resolvedAt: undefined,
        completedAt: undefined,
      };
    } else if (
      prevTask.type === 'INITIATIVE' &&
      updates.status !== undefined &&
      updates.status !== prevTask.status
    ) {
      // Initiative workflow gate: a status carried in `updates` must obey the
      // centralised rules. A refused move drops the status change (and its
      // completion fields) while every other field still saves, so editing
      // titles/assignees on an Initiative never breaks.
      const gate = evaluateInitiativeStatusChange(prevTask, updates.status);
      if (!gate.allowed) {
        console.warn(
          `[initiative-workflow] Refused ${prevTask.status} -> ${updates.status} on "${prevTask.title}" — not a legal Initiative transition.`
        );
        statusRefused = true;
        statusReason = explainInitiativeTransition(
          prevTask.status,
          updates.status,
          prevTask.initiativePreviousStatus
        );
        const { status: _status, resolution: _resolution, resolvedAt: _resolvedAt, completedAt: _completedAt, ...rest } = updates;
        gatedUpdates = rest;
      } else {
        gatedUpdates = { ...updates, initiativePreviousStatus: gate.initiativePreviousStatus };
      }
    }

    // A resolution-only change is a real status transition too: a cancelled
    // issue displays CANCELLED (not DONE), so flipping the resolution must
    // append a record instead of silently keeping the old history.
    const nextStatusValue = gatedUpdates.status !== undefined ? gatedUpdates.status : prevTask.status;
    const nextResolutionValue = 'resolution' in gatedUpdates ? gatedUpdates.resolution : prevTask.resolution;
    const transitions = nextStatusTransitions(
      prevTask,
      nextStatusValue,
      currentUserId || '',
      get().users,
      nextResolutionValue
    );

    const updatedTask: Task = {
      ...prevTask,
      ...gatedUpdates,
      updatedAt: new Date().toISOString(),
      ...(transitions && transitions !== prevTask.statusTransitions
        ? { statusTransitions: transitions }
        : {}),
    };

    let nextTodos = get().todos;
    // If assignee changed, or if task is assigned and title/priority/dueDate/status changed
    if (
      gatedUpdates.assigneeId !== undefined ||
      (updatedTask.assigneeId &&
        (gatedUpdates.title !== undefined ||
          gatedUpdates.priority !== undefined ||
          gatedUpdates.dueDate !== undefined ||
          gatedUpdates.status !== undefined ||
          gatedUpdates.description !== undefined))
    ) {
      nextTodos = syncTaskToUserTodo(
        nextTodos,
        updatedTask,
        get().projects,
        get().users,
        undefined,
        prevTask.assigneeId
      );
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      todos: nextTodos,
    }));
    return statusRefused ? { ok: false, reason: statusReason } : { ok: true };
  },

  reorderTasks: (activeTaskId, targetTaskId, position = 'after') => {
    set((s) => {
      const list = [...s.tasks];
      const activeIndex = list.findIndex((t) => t.id === activeTaskId);
      const targetIndex = list.findIndex((t) => t.id === targetTaskId);
      if (activeIndex === -1 || targetIndex === -1 || activeIndex === targetIndex) {
        return s;
      }
      const [moved] = list.splice(activeIndex, 1);
      let insertIndex = list.findIndex((t) => t.id === targetTaskId);
      if (position === 'after') {
        insertIndex += 1;
      }
      list.splice(insertIndex, 0, moved);
      return { tasks: list };
    });
  },

  moveTask: (taskId, updates, currentUserId) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    if (!prevTask) return { ok: false, reason: 'Work item not found.' };

    // Converting into an INITIATIVE rewrites the status to Backlog inside
    // updateTask — never push a generic status through the status path first.
    const convertingToInitiative = prevTask.type !== 'INITIATIVE' && updates.type === 'INITIATIVE';

    let result: StatusChangeResult = { ok: true };
    if (!convertingToInitiative && updates.status && updates.status !== prevTask.status && currentUserId) {
      result = get().updateTaskStatus(taskId, updates.status, currentUserId);
    }

    const updateResult = get().updateTask(taskId, updates, currentUserId);
    return result.ok ? updateResult : result;
  },

  deleteTask: (taskId, deleteChildren = true) => {
    const allTasks = get().tasks;
    const idsToDelete = new Set<string>([taskId]);

    if (deleteChildren) {
      // Find all direct children
      let foundMore = true;
      while (foundMore) {
        foundMore = false;
        allTasks.forEach((t) => {
          if (t.parentId && idsToDelete.has(t.parentId) && !idsToDelete.has(t.id)) {
            idsToDelete.add(t.id);
            foundMore = true;
          }
        });
      }
    }

    set((s) => ({
      tasks: s.tasks.filter((t) => !idsToDelete.has(t.id)),
      todos: s.todos.filter((t) => !t.taskId || !idsToDelete.has(t.taskId)),
    }));
  },

  assignTask: (taskId, assigneeId, currentUserId) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    const prevAssigneeId = prevTask?.assigneeId;

    get().updateTask(taskId, { assigneeId });
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) {
      set((s) => ({
        todos: syncTaskToUserTodo(
          s.todos,
          task,
          s.projects,
          s.users,
          currentUserId,
          prevAssigneeId
        ),
      }));

      get().addNotification({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned to You',
        message: `You have been assigned: "${task.title}". Added to your To-Do list.`,
        read: false,
        relatedEntityId: taskId,
        relatedEntityType: 'TASK',
        createdAt: new Date().toISOString(),
      });
      get().addActivity({
        organizationId: 'org-001',
        userId: currentUserId,
        action: 'assigned task',
        entityType: 'TASK',
        entityId: taskId,
        entityTitle: task.title,
        createdAt: new Date().toISOString(),
      });
    }
  },

  addComment: (taskId, userId, content, attachments = []) => {
    const comment: Comment = {
      id: `c-${generateId()}`, userId, content, createdAt: new Date().toISOString(), attachments,
      mentionIds: mentionIdsFromHtml(content),
    };
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...t.comments, comment], updatedAt: new Date().toISOString() } : t
      ),
    }));
    // Notify task assignee if someone else commented
    const task = get().tasks.find((t) => t.id === taskId);
    if (task?.assigneeId && task.assigneeId !== userId) {
      const commenter = get().users.find((u) => u.id === userId);
      get().addNotification({
        userId: task.assigneeId, type: 'TASK_STATUS_CHANGED',
        title: 'New Comment', message: `${commenter?.name || 'Someone'} commented on "${task.title}"`,
        read: false, relatedEntityId: taskId, relatedEntityType: 'TASK',
        createdAt: new Date().toISOString(),
      });
    }
  },

  // Workflow state for sprint issues that are not store tasks yet (seed work items
  // rendered by buildSprintIssuesMap). Stored centrally so the Live Iteration page and
  // the Iteration Board always agree on status / terminal resolution — and so the
  // transition history recorded here is carried onto the Task when it is materialised.
  setIssueStatusOverride: (issueId, status, meta) => {
    set((s) => {
      const resolutions = { ...s.issueResolutions };
      // A terminal resolution only applies while the issue sits in DONE.
      if (status !== 'DONE') delete resolutions[issueId];
      else if (meta?.resolution) resolutions[issueId] = meta.resolution;

      const previous = s.issueStatusOverrides[issueId] ?? meta?.previousStatus;
      const from: TransitionStatus | undefined =
        previous === undefined
          ? undefined
          : s.issueResolutions[issueId] === 'CANCELLED'
          ? 'CANCELLED'
          : previous;
      const to: TransitionStatus = meta?.resolution === 'CANCELLED' ? 'CANCELLED' : status;
      const transitions = recordOverrideTransition({
        history: s.issueStatusTransitions[issueId],
        from,
        to,
        sourceEnteredAt: s.issueStatusEnteredAt[issueId] ?? meta?.sourceEnteredAt,
        userId: meta?.userId,
        users: s.users,
      });

      return {
        issueStatusOverrides: { ...s.issueStatusOverrides, [issueId]: status },
        issueResolutions: resolutions,
        ...(transitions
          ? { issueStatusTransitions: { ...s.issueStatusTransitions, [issueId]: transitions } }
          : {}),
        issueStatusEnteredAt: { ...s.issueStatusEnteredAt, [issueId]: new Date().toISOString() },
      };
    });
  },

  setIssueResolutionOverride: (issueId, resolution, meta) => {
    set((s) => {
      const next = { ...s.issueResolutions };
      if (resolution) next[issueId] = resolution;
      else delete next[issueId];

      const status = s.issueStatusOverrides[issueId] ?? meta?.previousStatus;
      if (status === undefined) return { issueResolutions: next };
      const from: TransitionStatus = s.issueResolutions[issueId] === 'CANCELLED' ? 'CANCELLED' : status;
      const to: TransitionStatus = resolution === 'CANCELLED' ? 'CANCELLED' : status;
      const transitions = recordOverrideTransition({
        history: s.issueStatusTransitions[issueId],
        from,
        to,
        sourceEnteredAt: s.issueStatusEnteredAt[issueId] ?? meta?.sourceEnteredAt,
        userId: meta?.userId,
        users: s.users,
      });

      return {
        issueResolutions: next,
        ...(transitions
          ? { issueStatusTransitions: { ...s.issueStatusTransitions, [issueId]: transitions } }
          : {}),
        ...(transitions ? { issueStatusEnteredAt: { ...s.issueStatusEnteredAt, [issueId]: new Date().toISOString() } } : {}),
      };
    });
  },

  setIssueAssigneeOverride: (issueId, assigneeId) => {
    set((s) => ({ issueAssigneeOverrides: { ...s.issueAssigneeOverrides, [issueId]: assigneeId } }));
  },

  addIssueComment: (issueId, userId, content, attachments = []) => {
    const comment: Comment = {
      id: `ic-${generateId()}`,
      userId,
      content,
      createdAt: new Date().toISOString(),
      attachments,
      mentionIds: mentionIdsFromHtml(content),
    };
    set((s) => ({
      issueComments: { ...s.issueComments, [issueId]: [...(s.issueComments[issueId] || []), comment] },
    }));
  },

  toggleTaskFlag: (taskId, isFlagged, reason, currentUserId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const now = new Date().toISOString();
    const updates: Partial<Task> = {
      isFlagged,
      flaggedReason: isFlagged ? (reason?.trim() || 'Impediment flagged / Needs attention') : undefined,
      flaggedAt: isFlagged ? now : undefined,
      flaggedById: isFlagged ? currentUserId : undefined,
      updatedAt: now,
    };
    get().updateTask(taskId, updates);

    if (currentUserId) {
      get().addActivity({
        organizationId: 'org-001',
        userId: currentUserId,
        action: isFlagged ? `flagged task as impeded: "${reason || 'Needs attention'}"` : 'cleared impediment flag from task',
        entityType: 'TASK',
        entityId: taskId,
        entityTitle: task.title,
        createdAt: now,
      });

      if (isFlagged && task.assigneeId && task.assigneeId !== currentUserId) {
        get().addNotification({
          userId: task.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'Task Impeded / Flagged',
          message: `Task "${task.title}" was flagged: ${reason || 'Impediment flagged'}`,
          read: false,
          relatedEntityId: taskId,
          relatedEntityType: 'TASK',
          createdAt: now,
        });
      }
    }
  },

  // ---- BUG ----
  createBug: (bugData) => {
    const newBug: Bug = {
      ...bugData,
      id: `bug-${generateId()}`,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ bugs: [...s.bugs, newBug] }));
    get().addActivity({
      organizationId: 'org-001',
      userId: bugData.reportedById,
      action: 'reported bug',
      entityType: 'BUG',
      entityId: newBug.id,
      entityTitle: newBug.title,
      createdAt: new Date().toISOString(),
    });
    get().addNotification({
      userId: 'u-tl-01',
      type: 'BUG_REPORTED',
      title: 'New Bug Reported',
      message: `Bug: "${newBug.title}" has been reported.`,
      read: false,
      relatedEntityId: newBug.id,
      relatedEntityType: 'BUG',
      createdAt: new Date().toISOString(),
    });
    return newBug;
  },

  updateBugStatus: (bugId, status) => {
    set((s) => ({
      bugs: s.bugs.map((b) =>
        b.id === bugId
          ? { ...b, status, updatedAt: new Date().toISOString(), fixedAt: status === 'FIXED' ? new Date().toISOString() : b.fixedAt }
          : b
      ),
    }));
  },

  assignBug: (bugId, userId) => {
    set((s) => ({
      bugs: s.bugs.map((b) => b.id === bugId ? { ...b, assignedToId: userId, updatedAt: new Date().toISOString() } : b),
    }));
    const bug = get().bugs.find((b) => b.id === bugId);
    if (bug) {
      get().addNotification({
        userId,
        type: 'BUG_ASSIGNED',
        title: 'Bug Assigned to You',
        message: `Bug: "${bug.title}" has been assigned to you.`,
        read: false,
        relatedEntityId: bugId,
        relatedEntityType: 'BUG',
        createdAt: new Date().toISOString(),
      });
    }
  },

  // ---- TODO ----
  createTodo: (todoData) => {
    const newTodo: Todo = {
      ...todoData,
      id: `todo-${generateId()}`,
      source: 'PERSONAL',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ todos: [...s.todos, newTodo] }));
    return newTodo;
  },

  updateTodo: (todoId, updates) => {
    set((s) => ({
      todos: s.todos.map((t) => t.id === todoId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
    }));
  },

  toggleTodo: (todoId) => {
    const target = get().todos.find((t) => t.id === todoId);
    if (!target) return;
    const nextCompleted = !target.completed;

    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));

    // If this todo is linked to an assigned task, keep task status in sync
    if (target.taskId) {
      const task = get().tasks.find((tk) => tk.id === target.taskId);
      if (task) {
        if (nextCompleted && task.status !== 'DONE') {
          get().updateTaskStatus(target.taskId, 'DONE', target.userId);
        } else if (!nextCompleted && task.status === 'DONE') {
          get().updateTaskStatus(target.taskId, 'IN_PROGRESS', target.userId);
        }
      }
    }
  },

  deleteTodo: (todoId) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== todoId) }));
  },

  // ---- NOTIFICATIONS ----
  markNotificationRead: (notifId) => {
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === notifId ? { ...n, read: true } : n),
    }));
  },

  markAllNotificationsRead: (userId) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.userId === userId ? { ...n, read: true } : n
      ),
    }));
  },

  // ---- HELPERS ----
  addActivity: (activity) => {
    let resolvedProjectId = activity.projectId;
    if (!resolvedProjectId) {
      if (activity.entityType === 'PROJECT') {
        resolvedProjectId = activity.entityId;
      } else if (activity.entityType === 'TASK') {
        resolvedProjectId = get().tasks.find((t) => t.id === activity.entityId)?.projectId;
      } else if (activity.entityType === 'BUG') {
        resolvedProjectId = get().bugs.find((b) => b.id === activity.entityId)?.projectId;
      } else if (activity.entityType === 'SPRINT') {
        resolvedProjectId = get().sprints.find((s) => s.id === activity.entityId)?.projectId;
      } else if (activity.entityType === 'RELEASE') {
        resolvedProjectId = get().releases.find((r) => r.id === activity.entityId)?.projectId;
      } else if (activity.entityType === 'INITIATIVE') {
        resolvedProjectId = get().initiatives.find((i) => i.id === activity.entityId)?.projectId;
      }
    }

    const newActivity: Activity = {
      ...activity,
      projectId: resolvedProjectId,
      id: `act-${generateId()}`,
    };
    set((s) => ({ activities: [newActivity, ...s.activities] }));
  },

  addNotification: (notif) => {
    const newNotif: Notification = {
      ...notif,
      id: `notif-${generateId()}`,
    };
    set((s) => ({ notifications: [newNotif, ...s.notifications] }));
  },

  // ---- RELEASE ----
  createRelease: (releaseData) => {
    const newRelease: Release = {
      ...releaseData,
      id: `rel-${generateId()}`,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ releases: [...s.releases, newRelease] }));
    get().addActivity({
      organizationId: 'org-001',
      userId: releaseData.createdById,
      action: 'created release',
      entityType: 'RELEASE',
      entityId: newRelease.id,
      entityTitle: newRelease.name,
      createdAt: new Date().toISOString(),
    });
    return newRelease;
  },

  updateRelease: (releaseId, updates) => {
    set((s) => ({
      releases: s.releases.map((r) =>
        r.id === releaseId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      ),
    }));
  },

  deleteRelease: (releaseId) => {
    set((s) => ({ releases: s.releases.filter((r) => r.id !== releaseId) }));
  },

  // ---- DEPENDENCIES ----
  addTaskDependency: (taskId, dependsOnTaskId, type = 'BLOCKS', comment) => {
    // Validation: never link an issue to itself, never store the same
    // relationship twice (the inverse record would be the SAME relationship).
    if (!taskId || !dependsOnTaskId || taskId === dependsOnTaskId) return false;
    if (isDuplicateLink(get().taskDependencies, taskId, dependsOnTaskId, type)) return false;

    const newDep: TaskDependency = {
      id: `dep-${generateId()}`,
      taskId,
      dependsOnTaskId,
      type,
      comment: comment?.trim() ? comment.trim() : undefined,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ taskDependencies: [...s.taskDependencies, newDep] }));
    persistTaskDependency(newDep);

    const task = get().tasks.find((t) => t.id === taskId);
    const target = get().tasks.find((t) => t.id === dependsOnTaskId);
    if (task && target) {
      const note = newDep.comment ? ` — ${plainTextFromHtml(newDep.comment)}` : '';
      get().addActivity({
        organizationId: 'org-001',
        userId: task.createdById,
        action: `linked ${task.title} ${ISSUE_LINK_LABEL[type]} ${target.title}${note}`,
        entityType: 'TASK',
        entityId: taskId,
        entityTitle: task.title,
        createdAt: new Date().toISOString(),
      });
    }
    return true;
  },

  removeTaskDependency: (dependencyId) => {
    set((s) => ({
      taskDependencies: s.taskDependencies.filter((d) => d.id !== dependencyId),
    }));
    unpersistTaskDependency(dependencyId);
  },

  // Re-bind links saved in a previous session to the Tasks that exist now
  // (materialising seed/board issues on demand). Idempotent: records already
  // present — or already covered by an equivalent record — are skipped.
  rehydrateIssueLinks: () => {
    const records = readPersistedIssueLinks();
    if (records.length === 0) return;

    const current = get().taskDependencies;
    const additions: TaskDependency[] = [];

    for (const record of records) {
      if (current.some((d) => d.id === record.id)) continue;
      const resolved = resolvePersistedIssueLink(record);
      if (!resolved) continue;
      if (isDuplicateLink(current.concat(additions), resolved.from.id, resolved.to.id, record.type)) continue;
      additions.push({
        id: record.id,
        taskId: resolved.from.id,
        dependsOnTaskId: resolved.to.id,
        type: record.type,
        comment: record.comment,
        createdAt: record.createdAt,
      });
    }

    if (additions.length > 0) {
      set((s) => ({ taskDependencies: [...s.taskDependencies, ...additions] }));
    }
  },

  // ---- AUTOMATION ----
  createAutomationRule: (ruleData) => {
    const newRule: AutomationRule = {
      ...ruleData,
      id: `auto-${generateId()}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ automationRules: [...s.automationRules, newRule] }));
    return newRule;
  },

  toggleAutomationRule: (ruleId) => {
    set((s) => ({
      automationRules: s.automationRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  },

  deleteAutomationRule: (ruleId) => {
    set((s) => ({
      automationRules: s.automationRules.filter((r) => r.id !== ruleId),
    }));
  },

  // ---- SPRINT GOAL ----
  updateSprintGoal: (sprintId, goal) => {
    set((s) => ({
      sprints: s.sprints.map((sp) =>
        sp.id === sprintId ? { ...sp, goal } : sp
      ),
    }));
  },

  // ---- SPRINT HELPERS ----
  getNextSprintDates: (projectId) => {
    const projectSprints = get().sprints
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    if (projectSprints.length === 0) {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }

    const lastSprint = projectSprints[0];
    const lastEnd = new Date(lastSprint.endDate);
    const startDate = new Date(lastEnd);
    startDate.setDate(lastEnd.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  },

  validateSprintOverlap: (projectId, startDate, endDate, excludeSprintId) => {
    const projectSprints = get().sprints.filter(
      (s) => s.projectId === projectId && s.id !== excludeSprintId
    );
    const newStart = new Date(startDate).getTime();
    const newEnd = new Date(endDate).getTime();
    return projectSprints.some((sprint) => {
      const existingStart = new Date(sprint.startDate).getTime();
      const existingEnd = new Date(sprint.endDate).getTime();
      return newStart <= existingEnd && newEnd >= existingStart;
    });
  },

  // ---- STORY POINTS ----
  setTaskStoryPoints: (taskId, points) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, storyPoints: points, updatedAt: new Date().toISOString() } : t
      ),
    }));
  },

  // ---- TIME TRACKING ----
  addTimeLog: (taskId, userId, hours, description) => {
    const log: TimeLog = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      taskId, userId, hours, description,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              timeLogs: [...(t.timeLogs || []), log],
              loggedHours: (t.loggedHours || 0) + hours,
              remainingEstimate: Math.max(0, (t.remainingEstimate || t.originalEstimate || 0) - hours),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
  },

  updateTaskEstimates: (taskId, updates) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    }));
  },

  // ---- EPIC ROLLUP ----
  getEpicRollup: (epicId) => {
    const allTasks = get().tasks;
    // Collect all descendants recursively
    const collectDescendants = (parentId: string): typeof allTasks => {
      const direct = allTasks.filter((t) => t.parentId === parentId);
      let result = [...direct];
      for (const child of direct) {
        result = [...result, ...collectDescendants(child.id)];
      }
      return result;
    };
    const children = collectDescendants(epicId);
    const totalTasks = children.length;
    const completed = children.filter((t) => t.status === 'DONE').length;
    const inProgress = children.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING' || t.status === 'BUG_FIX').length;
    const blocked = children.filter((t) => t.status === 'BLOCKED').length;
    const remaining = totalTasks - completed - inProgress - blocked;
    const completionPct = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
    const totalPoints = children.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = children.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const remainingPoints = totalPoints - completedPoints;
    return { totalTasks, completed, inProgress, remaining, blocked, completionPct, totalPoints, completedPoints, remainingPoints };
  },

  // ---- OVERDUE DETECTION ----
  getOverdueTasks: (projectId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return get().tasks
      .filter((t) => {
        if (!t.dueDate || t.status === 'DONE') return false;
        if (projectId && t.projectId !== projectId) return false;
        return new Date(t.dueDate) < today;
      })
      .map((t) => {
        const due = new Date(t.dueDate!);
        const diffMs = today.getTime() - due.getTime();
        return {
          taskId: t.id,
          isOverdue: true,
          daysOverdue: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
          dueDate: t.dueDate!,
        };
      });
  },

  isTaskOverdue: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task || !task.dueDate || task.status === 'DONE') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.dueDate) < today;
  },

  // ---- SPRINT AUTOMATION ----
  checkAndAutoStartSprints: () => {
    const today = new Date().toISOString().split('T')[0];
    const { sprints } = get();
    sprints.forEach((sprint) => {
      if (sprint.status === 'PLANNED' && sprint.startDate <= today) {
        // Only ONE active sprint per project: never auto-start a sprint while the
        // project already has an active iteration (activating completes/deactivates
        // the previous one via the manual start flow, not here).
        const projectHasActive = get().sprints.some(
          (s) => s.projectId === sprint.projectId && s.status === 'ACTIVE'
        );
        if (projectHasActive) return;
        get().updateSprintStatus(sprint.id, 'ACTIVE');
        get().addNotification({
          userId: sprint.createdById,
          type: 'SPRINT_STARTED',
          title: 'Iteration Auto-Started',
          message: `Iteration "${sprint.name}" has been automatically started.`,
          read: false,
          relatedEntityId: sprint.id,
          relatedEntityType: 'SPRINT',
          createdAt: new Date().toISOString(),
        });
      }
    });
  },

  checkAndAutoCompleteSprints: () => {
    const today = new Date().toISOString().split('T')[0];
    const { sprints, sprintConfigs } = get();
    sprints.forEach((sprint) => {
      if (sprint.status === 'ACTIVE' && sprint.endDate < today) {
        // Never leave the project without an active iteration: only auto-complete
        // when a PLANNED successor exists to take over, so the Live Iteration page
        // can never fall back to its empty state while work remains planned.
        const hasSuccessor = get().sprints.some(
          (s) => s.projectId === sprint.projectId && s.status === 'PLANNED'
        );
        if (!hasSuccessor) return;
        const config = sprintConfigs[sprint.projectId];
        const action = config?.incompleteTaskAction || 'MOVE_TO_NEXT_SPRINT';
        get().handleIncompleteTasks(sprint.id, action);
        get().updateSprintStatus(sprint.id, 'COMPLETED');
        get().addNotification({
          userId: sprint.createdById,
          type: 'SPRINT_COMPLETED',
          title: 'Iteration Auto-Completed',
          message: `Iteration "${sprint.name}" has been automatically completed.`,
          read: false,
          relatedEntityId: sprint.id,
          relatedEntityType: 'SPRINT',
          createdAt: new Date().toISOString(),
        });
      }
    });
  },

  handleIncompleteTasks: (sprintId, action) => {
    const sprint = get().sprints.find((s) => s.id === sprintId);
    if (!sprint) return;
    const incompleteTasks = get().tasks.filter(
      (t) => t.sprintId === sprintId && t.status !== 'DONE'
    );

    if (action === 'MOVE_TO_NEXT_SPRINT') {
      const nextDates = get().getNextSprintDates(sprint.projectId);
      const nextSprint = get().sprints.find(
        (s) => s.projectId === sprint.projectId && s.status === 'PLANNED'
      );
      const targetSprintId = nextSprint?.id;
      incompleteTasks.forEach((task) => {
        get().updateTask(task.id, { sprintId: targetSprintId });
      });
    } else if (action === 'MOVE_TO_BACKLOG') {
      incompleteTasks.forEach((task) => {
        get().updateTask(task.id, { sprintId: undefined });
      });
    }
    // REMAIN_IN_COMPLETED: do nothing, tasks stay in completed sprint
  },

  setSprintConfig: (projectId, config) => {
    set((s) => ({
      sprintConfigs: {
        ...s.sprintConfigs,
        [projectId]: {
          ...(s.sprintConfigs[projectId] || { projectId, incompleteTaskAction: 'MOVE_TO_NEXT_SPRINT' as SprintIncompleteTaskAction, updatedAt: new Date().toISOString() }),
          ...config,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },

  // ---- AUTOMATION ENGINE (with loop prevention) ----
  executeAutomationRule: (ruleId, trigger, entity, _depth = 0, _chain: string[] = []) => {
    const MAX_DEPTH = 5;
    const rule = get().automationRules.find((r) => r.id === ruleId);
    if (!rule || !rule.enabled) return;
    if (_depth >= MAX_DEPTH) {
      const exec: AutomationExecution = {
        id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ruleId, triggeredBy: entity.type, triggeredEntityType: entity.type, triggeredEntityId: entity.id,
        success: false, message: `Loop prevention: max depth ${MAX_DEPTH} reached. Chain: ${_chain.join(' → ')}`,
        executedAt: new Date().toISOString(),
      };
      set((s) => ({ automationExecutions: [exec, ...s.automationExecutions] }));
      return;
    }
    if (_chain.includes(ruleId)) {
      const exec: AutomationExecution = {
        id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ruleId, triggeredBy: entity.type, triggeredEntityType: entity.type, triggeredEntityId: entity.id,
        success: false, message: `Cycle detected: rule ${ruleId} already in chain [${_chain.join(', ')}]`,
        executedAt: new Date().toISOString(),
      };
      set((s) => ({ automationExecutions: [exec, ...s.automationExecutions] }));
      return;
    }

    // Check conditions
    const conditionsMet = rule.conditions.every((cond) => {
      const task = get().tasks.find((t) => t.id === entity.id);
      if (!task) return false;
      const fieldValue = (task as any)[cond.field];
      switch (cond.operator) {
        case 'EQUALS': return String(fieldValue) === cond.value;
        case 'NOT_EQUALS': return String(fieldValue) !== cond.value;
        case 'GREATER_THAN': return Number(fieldValue) > Number(cond.value);
        case 'LESS_THAN': return Number(fieldValue) < Number(cond.value);
        case 'CONTAINS': return String(fieldValue).includes(cond.value);
        default: return true;
      }
    });

    if (!conditionsMet) return;

    // Execute actions
    const execution: AutomationExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ruleId, triggeredBy: entity.type, triggeredEntityType: entity.type, triggeredEntityId: entity.id,
      success: true, executedAt: new Date().toISOString(),
    };

    rule.actions.forEach((action) => {
      try {
        const task = get().tasks.find((t) => t.id === entity.id);
        switch (action) {
          case 'UPDATE_SPRINT_PROGRESS':
            if (task?.sprintId) {
              const sprintTasks = get().tasks.filter((t) => t.sprintId === task.sprintId);
              const doneCount = sprintTasks.filter((t) => t.status === 'DONE').length;
              // Progress is auto-calculated elsewhere
            }
            break;
          case 'UPDATE_PROJECT_PROGRESS':
            if (task) {
              const allProjTasks = get().tasks.filter((t) => t.projectId === task.projectId);
              const done = allProjTasks.filter((t) => t.status === 'DONE').length;
              const progress = allProjTasks.length > 0 ? Math.round((done / allProjTasks.length) * 100) : 0;
              get().updateProject(task.projectId, { progress });
            }
            break;
          case 'NOTIFY_ASSIGNEE':
            if (task?.assigneeId) {
              get().addNotification({
                userId: task.assigneeId, type: 'TASK_STATUS_CHANGED',
                title: 'Automation Alert', message: `Rule "${rule.name}" triggered for "${task.title}"`,
                read: false, relatedEntityId: task.id, relatedEntityType: 'TASK',
                createdAt: new Date().toISOString(),
              });
            }
            break;
          case 'CHANGE_STATUS':
            if (task && rule.actionConfig?.status) {
              get().updateTaskStatus(task.id, rule.actionConfig.status as TaskStatus, 'automation');
            }
            break;
          case 'LOG_ACTIVITY':
            if (task) {
              get().addActivity({
                organizationId: 'org-001', userId: 'automation',
                action: `automation: ${rule.name}`, entityType: 'TASK',
                entityId: task.id, entityTitle: task.title,
                createdAt: new Date().toISOString(),
              });
            }
            break;
          case 'NOTIFY_TEAM_LEAD':
            if (task?.teamId) {
              const team = get().teams.find((t) => t.id === task.teamId);
              if (team?.teamLeaderId) {
                get().addNotification({
                  userId: team.teamLeaderId, type: 'TASK_STATUS_CHANGED',
                  title: 'Automation Alert', message: `Rule "${rule.name}" triggered for "${task.title}"`,
                  read: false, relatedEntityId: task.id, relatedEntityType: 'TASK',
                  createdAt: new Date().toISOString(),
                });
              }
            }
            break;
          case 'ASSIGN_USER':
            if (task && rule.actionConfig?.assigneeId) {
              get().updateTask(task.id, { assigneeId: rule.actionConfig.assigneeId });
              get().addActivity({
                organizationId: 'org-001', userId: 'automation',
                action: `auto-assigned task`, entityType: 'TASK',
                entityId: task.id, entityTitle: task.title,
                createdAt: new Date().toISOString(),
              });
            }
            break;
          case 'ASSIGN_TEAM':
            if (task && rule.actionConfig?.teamId) {
              get().updateTask(task.id, { teamId: rule.actionConfig.teamId });
              get().addActivity({
                organizationId: 'org-001', userId: 'automation',
                action: `auto-assigned team`, entityType: 'TASK',
                entityId: task.id, entityTitle: task.title,
                createdAt: new Date().toISOString(),
              });
            }
            break;
          case 'CHANGE_PRIORITY':
            if (task && rule.actionConfig?.priority) {
              get().updateTask(task.id, { priority: rule.actionConfig.priority as any });
            }
            break;
          case 'ADD_NOTIFICATION':
            if (task?.assigneeId) {
              get().addNotification({
                userId: task.assigneeId, type: 'TASK_STATUS_CHANGED',
                title: rule.actionConfig?.notifTitle || 'Automation Notification',
                message: rule.actionConfig?.notifMessage || `Rule "${rule.name}" executed on "${task.title}"`,
                read: false, relatedEntityId: task.id, relatedEntityType: 'TASK',
                createdAt: new Date().toISOString(),
              });
            }
            break;
          case 'UPDATE_SPRINT':
            if (task && rule.actionConfig?.sprintId) {
              get().updateTask(task.id, { sprintId: rule.actionConfig.sprintId });
            }
            break;
          case 'UPDATE_RELEASE':
            if (task && rule.actionConfig?.releaseId) {
              get().updateTask(task.id, { releaseId: rule.actionConfig.releaseId });
            }
            break;
        }
      } catch {
        execution.success = false;
        execution.message = `Failed to execute action: ${action}`;
      }
    });

    set((s) => ({
      automationExecutions: [execution, ...s.automationExecutions],
      automationRules: s.automationRules.map((r) =>
        r.id === ruleId ? { ...r, lastExecutedAt: new Date().toISOString(), executionCount: r.executionCount + 1 } : r
      ),
    }));
  },

  checkAndExecuteAutomations: (trigger, entity) => {
    const { automationRules } = get();
    const matchingRules = automationRules.filter((r) => r.enabled && r.trigger === trigger);
    matchingRules.forEach((rule) => {
      get().executeAutomationRule(rule.id, trigger, entity, 0, []);
    });
  },

  // ---- BULK OPERATIONS ----
  toggleBulkSelect: (taskId) => {
    set((s) => ({
      bulkSelectedTaskIds: s.bulkSelectedTaskIds.includes(taskId)
        ? s.bulkSelectedTaskIds.filter((id) => id !== taskId)
        : [...s.bulkSelectedTaskIds, taskId],
    }));
  },

  selectAllTasks: (taskIds) => {
    set({ bulkSelectedTaskIds: taskIds });
  },

  clearBulkSelection: () => {
    set({ bulkSelectedTaskIds: [] });
  },

  bulkUpdateStatus: (status) => {
    const { bulkSelectedTaskIds } = get();
    let updated = 0;
    let refused = 0;
    bulkSelectedTaskIds.forEach((taskId) => {
      const res = get().updateTaskStatus(taskId, status, 'bulk-operation');
      if (res.ok) updated += 1;
      else refused += 1;
    });
    set({ bulkSelectedTaskIds: [] });
    return { updated, refused };
  },

  bulkUpdatePriority: (priority) => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().updateTask(taskId, { priority });
    });
    set({ bulkSelectedTaskIds: [] });
  },

  bulkAssignUser: (userId) => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().updateTask(taskId, { assigneeId: userId });
    });
    set({ bulkSelectedTaskIds: [] });
  },

  bulkAssignTeam: (teamId) => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().updateTask(taskId, { teamId });
    });
    set({ bulkSelectedTaskIds: [] });
  },

  bulkMoveSprint: (sprintId) => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().updateTask(taskId, { sprintId });
    });
    set({ bulkSelectedTaskIds: [] });
  },

  bulkAssignRelease: (releaseId) => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().updateTask(taskId, { releaseId });
    });
    set({ bulkSelectedTaskIds: [] });
  },

  bulkDeleteTasks: () => {
    const { bulkSelectedTaskIds } = get();
    bulkSelectedTaskIds.forEach((taskId) => {
      get().deleteTask(taskId, true);
    });
    set({ bulkSelectedTaskIds: [] });
  },

  // ---- INITIATIVE ----
  createInitiative: (data) => {
    const newInit: Initiative = {
      ...data, id: `init-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    set((s) => ({ initiatives: [...s.initiatives, newInit] }));
    return newInit;
  },

  updateInitiative: (initiativeId, updates) => {
    set((s) => ({
      initiatives: s.initiatives.map((i) =>
        i.id === initiativeId ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      ),
    }));
  },

  deleteInitiative: (initiativeId) => {
    set((s) => ({ initiatives: s.initiatives.filter((i) => i.id !== initiativeId) }));
  },

  // ---- CUSTOM FIELDS ----
  createCustomField: (data) => {
    const newField: CustomFieldDefinition = {
      ...data, id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ customFieldDefinitions: [...s.customFieldDefinitions, newField] }));
    return newField;
  },

  updateCustomField: (fieldId, updates) => {
    set((s) => ({
      customFieldDefinitions: s.customFieldDefinitions.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    }));
  },

  deleteCustomField: (fieldId) => {
    set((s) => ({ customFieldDefinitions: s.customFieldDefinitions.filter((f) => f.id !== fieldId) }));
  },

  setTaskCustomFieldValue: (taskId, fieldId, value) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, customFieldValues: { ...(t.customFieldValues || {}), [fieldId]: value }, updatedAt: new Date().toISOString() }
          : t
      ),
    }));
  },

  // ---- SAVED FILTERS ----
  saveFilter: (data) => {
    const newFilter: SavedFilter = {
      ...data, id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ savedFilters: [...s.savedFilters, newFilter] }));
    return newFilter;
  },

  deleteFilter: (filterId) => {
    set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== filterId) }));
  },

  // ---- SCENARIO ----
  createScenario: (data) => {
    const newScenario: Scenario = {
      ...data, id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      changes: [], createdAt: new Date().toISOString(),
    };
    set((s) => ({ scenarios: [...s.scenarios, newScenario] }));
    return newScenario;
  },

  addScenarioChange: (scenarioId, change) => {
    set((s) => ({
      scenarios: s.scenarios.map((sc) =>
        sc.id === scenarioId ? { ...sc, changes: [...sc.changes, change] } : sc
      ),
    }));
  },

  applyScenario: (scenarioId) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    scenario.changes.forEach((change) => {
      if (change.entityType === 'task') {
        get().updateTask(change.entityId, { [change.field]: change.newValue });
      } else if (change.entityType === 'sprint') {
        const sprint = get().sprints.find((s) => s.id === change.entityId);
        if (sprint) {
          set((s) => ({
            sprints: s.sprints.map((sp) =>
              sp.id === change.entityId ? { ...sp, [change.field]: change.newValue } : sp
            ),
          }));
        }
      } else if (change.entityType === 'release') {
        const release = get().releases.find((r) => r.id === change.entityId);
        if (release) {
          set((s) => ({
            releases: s.releases.map((r) =>
              r.id === change.entityId ? { ...r, [change.field]: change.newValue } : r
            ),
          }));
        }
      }
    });
    get().deleteScenario(scenarioId);
  },

  deleteScenario: (scenarioId) => {
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== scenarioId) }));
  },

  // ---- ADVANCED SEARCH ----
  searchTasks: (projectId, filters) => {
    let results = get().tasks.filter((t) => t.projectId === projectId);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }
    if (filters.status) results = results.filter((t) => t.status === filters.status);
    if (filters.priority) results = results.filter((t) => t.priority === filters.priority);
    if (filters.assigneeId) results = results.filter((t) => t.assigneeId === filters.assigneeId);
    if (filters.teamId) results = results.filter((t) => t.teamId === filters.teamId);
    if (filters.sprintId) results = results.filter((t) => t.sprintId === filters.sprintId);
    if (filters.stageId) results = results.filter((t) => t.stageId === filters.stageId);
    if (filters.epicId) results = results.filter((t) => t.parentId === filters.epicId);
    if (filters.releaseId) results = results.filter((t) => t.releaseId === filters.releaseId);
    if (filters.dueDate) results = results.filter((t) => t.dueDate === filters.dueDate);
    if (filters.overdue) {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'DONE');
    }
    if (filters.blocked) results = results.filter((t) => t.status === 'BLOCKED');
    return results;
  },

  // ---- EXPORT ----
  exportTasksCSV: (projectId) => {
    const tasks = get().tasks.filter((t) => t.projectId === projectId);
    const headers = ['ID', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Story Points', 'Due Date', 'Sprint', 'Est. Hours'];
    const rows = tasks.map((t) => {
      const assignee = get().users.find((u) => u.id === t.assigneeId);
      const sprint = get().sprints.find((s) => s.id === t.sprintId);
      return [t.id, t.title, t.type, t.status, t.priority, assignee?.name || '', t.storyPoints || '', t.dueDate || '', sprint?.name || '', t.estimatedHours || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  },

  exportSprintReportCSV: (sprintId) => {
    const sprint = get().sprints.find((s) => s.id === sprintId);
    if (!sprint) return '';
    const tasks = get().tasks.filter((t) => t.sprintId === sprintId);
    const headers = ['ID', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Story Points', 'Est. Hours', 'Actual Hours', 'Logged Hours'];
    const rows = tasks.map((t) => {
      const assignee = get().users.find((u) => u.id === t.assigneeId);
      return [t.id, t.title, t.type, t.status, t.priority, assignee?.name || '', t.storyPoints || '', t.estimatedHours || '', t.actualHours || '', t.loggedHours || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  },

  exportRoadmapCSV: (projectId) => {
    const epics = get().tasks.filter((t) => t.projectId === projectId && t.type === 'EPIC');
    const headers = ['Epic', 'Status', 'Priority', 'Start Date', 'Due Date', 'Progress', 'Story Points', 'Assignee'];
    const rows = epics.map((e) => {
      const assignee = get().users.find((u) => u.id === e.assigneeId);
      const childTasks = get().tasks.filter((t) => t.parentId === e.id);
      const completed = childTasks.filter((t) => t.status === 'DONE').length;
      const progress = childTasks.length > 0 ? Math.round((completed / childTasks.length) * 100) : 0;
      const points = childTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return [e.title, e.status, e.priority, e.startDate || '', e.dueDate || '', `${progress}%`, points, assignee?.name || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  },

  exportReleaseCSV: (releaseId) => {
    const release = get().releases.find((r) => r.id === releaseId);
    if (!release) return '';
    const tasks = get().tasks.filter((t) => t.releaseId === releaseId);
    const headers = ['ID', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Story Points', 'Sprint'];
    const rows = tasks.map((t) => {
      const assignee = get().users.find((u) => u.id === t.assigneeId);
      const sprint = get().sprints.find((s) => s.id === t.sprintId);
      return [t.id, t.title, t.type, t.status, t.priority, assignee?.name || '', t.storyPoints || '', sprint?.name || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  },

  exportProjectReportPDF: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return '';
    const tasks = get().tasks.filter((t) => t.projectId === projectId);
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const total = tasks.length;
    const points = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = tasks.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    return [
      `Project Report: ${project.name}`,
      `Status: ${project.status}`,
      `Progress: ${project.progress}%`,
      `Tasks: ${done}/${total} completed`,
      `Story Points: ${completedPoints}/${points} completed`,
      `Start: ${project.startDate}`,
      `Target: ${project.targetDate}`,
    ].join('\n');
  },

  // ---- APPROVALS ----
  requestApproval: (taskId, approverId) => {
    const approval: Approval = {
      id: `apr-${generateId()}`,
      taskId,
      approverId,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ approvals: [...s.approvals, approval] }));
  },

  approveTask: (taskId, approverId, comment) => {
    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.taskId === taskId && a.approverId === approverId && a.status === 'PENDING'
          ? { ...a, status: 'APPROVED' as ApprovalStatus, comment, timestamp: new Date().toISOString() }
          : a
      ),
    }));
  },

  rejectTask: (taskId, approverId, comment) => {
    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.taskId === taskId && a.approverId === approverId && a.status === 'PENDING'
          ? { ...a, status: 'REJECTED' as ApprovalStatus, comment, timestamp: new Date().toISOString() }
          : a
      ),
    }));
  },

  getTaskApprovals: (taskId) => {
    return get().approvals.filter((a) => a.taskId === taskId);
  },

  // ---- LIVE TIMER ----
  startTimer: (taskId, userId, projectId) => {
    const existing = get().activeTimer;
    if (existing) {
      if (existing.taskId === taskId) return;
      get().stopTimer();
    }
    const timer: ActiveTimer = {
      taskId,
      userId,
      projectId,
      startedAt: new Date().toISOString(),
    };
    set({ activeTimer: timer });
    try {
      localStorage.setItem('flowexec_active_timer', JSON.stringify(timer));
      // Broadcast to other tabs
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('flowexec_timer');
        bc.postMessage({ type: 'start', timer });
        bc.close();
      }
    } catch {}
  },

  stopTimer: () => {
    const timer = get().activeTimer;
    if (!timer) return;
    const elapsedMs = Date.now() - new Date(timer.startedAt).getTime();
    const hours = Math.round((elapsedMs / (1000 * 60 * 60)) * 100) / 100;
    if (hours > 0.01) {
      get().addTimeLog(timer.taskId, timer.userId, hours, 'Auto-logged via timer');
    }
    set({ activeTimer: null });
    try {
      localStorage.removeItem('flowexec_active_timer');
      // Broadcast to other tabs
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('flowexec_timer');
        bc.postMessage({ type: 'stop' });
        bc.close();
      }
    } catch {}
  },

  getTimerElapsed: () => {
    const timer = get().activeTimer;
    if (!timer) return 0;
    return Date.now() - new Date(timer.startedAt).getTime();
  },

  restoreTimer: () => {
    try {
      const saved = localStorage.getItem('flowexec_active_timer');
      if (saved) {
        const timer: ActiveTimer = JSON.parse(saved);
        if (timer.taskId && timer.userId && timer.startedAt) {
          set({ activeTimer: timer });
        }
      }
      // Listen for cross-tab timer sync
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('flowexec_timer');
        bc.onmessage = (event) => {
          const { type, timer: receivedTimer } = event.data;
          if (type === 'start' && receivedTimer) {
            set({ activeTimer: receivedTimer });
          } else if (type === 'stop') {
            set({ activeTimer: null });
          }
        };
      }
    } catch {}
  },

  // ---- MISSING DELETE ACTIONS ----
  deleteSprint: (sprintId: string) => {
    // Move tasks back to backlog
    set((s) => ({
      tasks: s.tasks.map((t) => t.sprintId === sprintId ? { ...t, sprintId: undefined } : t),
      sprints: s.sprints.filter((sp) => sp.id !== sprintId),
    }));
  },

  deleteProject: (projectId: string) => {
    set((s) => ({
      tasks: s.tasks.filter((t) => t.projectId !== projectId),
      bugs: s.bugs.filter((b) => b.projectId !== projectId),
      sprints: s.sprints.filter((sp) => sp.projectId !== projectId),
      pis: s.pis.filter((p) => p.projectId !== projectId),
      releases: s.releases.filter((r) => r.projectId !== projectId),
      projects: s.projects.filter((p) => p.id !== projectId),
    }));
    // Drop the persisted identity so a later project reusing this id can
    // never inherit a stale name/key override.
    removeProjectIdentityOverride(projectId);
  },

  deleteTeam: (teamId: string) => {
    set((s) => ({
      teams: s.teams.filter((t) => t.id !== teamId),
      tasks: s.tasks.map((t) => t.teamId === teamId ? { ...t, teamId: undefined } : t),
      users: s.users.map((u) => u.teamId === teamId ? { ...u, teamId: undefined } : u),
    }));
  },

  deleteWorkflow: (workflowId: string) => {
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== workflowId),
    }));
  },

  updateSprint: (sprintId: string, updates: Partial<Sprint>) => {
    set((s) => ({
      sprints: s.sprints.map((sp) =>
        sp.id === sprintId ? { ...sp, ...updates } : sp
      ),
    }));
  },

  // ---- ATTACHMENT & STORAGE METHODS ----
  getUserStorageUsed: (userId: string) => {
    let totalBytes = 0;
    const tasks = get().tasks;
    for (const t of tasks) {
      if (t.attachments) {
        for (const att of t.attachments) {
          if (att.userId === userId && att.source !== 'CLOUD_LINK') {
            totalBytes += att.fileSize || 0;
          }
        }
      }
    }
    return totalBytes;
  },

  getOrganizationStorageStats: () => {
    const org = get().organization;
    let computedUsed = 0;
    for (const t of get().tasks) {
      if (t.attachments) {
        for (const att of t.attachments) {
          if (att.source !== 'CLOUD_LINK') {
            computedUsed += att.fileSize || 0;
          }
        }
      }
    }
    // Blend with base usage from mock data if greater
    const usedBytes = Math.max(computedUsed, org.storageUsedBytes || 0);
    const limitBytes = org.storageLimitBytes || DEFAULT_ORG_STORAGE_LIMIT_BYTES;
    const percent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));
    const maxFileSizeBytes = org.maxFileSizeLimitBytes || DEFAULT_MAX_FILE_SIZE_BYTES;
    const perUserLimitBytes = org.perUserStorageLimitBytes || DEFAULT_USER_STORAGE_LIMIT_BYTES;

    return {
      usedBytes,
      limitBytes,
      percent,
      maxFileSizeBytes,
      perUserLimitBytes,
    };
  },

  uploadTaskAttachment: (taskId, attachmentData) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const org = get().organization;
    const orgStats = get().getOrganizationStorageStats();
    const userUsedBytes = get().getUserStorageUsed(attachmentData.userId);

    // If direct upload, validate quota guardrails
    if (attachmentData.source !== 'CLOUD_LINK' && attachmentData.fileSize > 0) {
      const validation = validateUploadQuota({
        fileSizeBytes: attachmentData.fileSize,
        currentOrgUsedBytes: orgStats.usedBytes,
        orgLimitBytes: orgStats.limitBytes,
        currentUserUsedBytes: userUsedBytes,
        userLimitBytes: orgStats.perUserLimitBytes,
        maxFileSizeBytes: orgStats.maxFileSizeBytes,
      });

      if (!validation.allowed) {
        return { success: false, error: validation.reason };
      }
    }

    const newAttachment: Attachment = {
      ...attachmentData,
      id: `att-${generateId()}`,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              attachments: [...(t.attachments || []), newAttachment],
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
      organization: {
        ...s.organization,
        storageUsedBytes: (s.organization.storageUsedBytes || 0) + (attachmentData.source !== 'CLOUD_LINK' ? attachmentData.fileSize : 0),
      },
    }));

    get().addActivity({
      organizationId: org.id,
      userId: attachmentData.userId,
      action: attachmentData.source === 'CLOUD_LINK' ? 'linked external asset' : 'uploaded attachment',
      entityType: 'TASK',
      entityId: taskId,
      entityTitle: `${task.title} (${newAttachment.fileName})`,
      createdAt: new Date().toISOString(),
    });

    return { success: true, attachment: newAttachment };
  },

  deleteTaskAttachment: (taskId, attachmentId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const attachment = task.attachments?.find((a) => a.id === attachmentId);
    const reclaimedBytes = (attachment && attachment.source !== 'CLOUD_LINK') ? attachment.fileSize : 0;

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              attachments: (t.attachments || []).filter((a) => a.id !== attachmentId),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
      organization: {
        ...s.organization,
        storageUsedBytes: Math.max(0, (s.organization.storageUsedBytes || 0) - reclaimedBytes),
      },
    }));

    if (attachment) {
      get().addActivity({
        organizationId: get().organization.id,
        userId: attachment.userId,
        action: 'deleted attachment',
        entityType: 'TASK',
        entityId: taskId,
        entityTitle: `${task.title} (${attachment.fileName})`,
        createdAt: new Date().toISOString(),
      });
    }
  },

  updateOrganization: (updates) => {
    set((s) => ({ organization: { ...s.organization, ...updates } }));
  },

  updateOrganizationStoragePlan: (plan) => {
    let limitBytes = 10 * 1024 * 1024 * 1024; // 10 GB
    if (plan === 'PRO') {
      limitBytes = 100 * 1024 * 1024 * 1024; // 100 GB
    } else if (plan === 'ENTERPRISE') {
      limitBytes = 1024 * 1024 * 1024 * 1024; // 1 TB
    }

    set((s) => ({
      organization: {
        ...s.organization,
        storagePlan: plan,
        storageLimitBytes: limitBytes,
      },
    }));
  },

  updateStorageCaps: (maxFileSizeBytes, perUserLimitBytes) => {
    set((s) => ({
      organization: {
        ...s.organization,
        maxFileSizeLimitBytes: maxFileSizeBytes,
        perUserStorageLimitBytes: perUserLimitBytes,
      },
    }));
  },

  // SPRINT RETROSPECTIVE ACTIONS
  getSprintRetrospective: (sprintId: string) => {
    return get().retrospectives.find((r) => r.sprintId === sprintId);
  },

  getRetrospectiveItems: (sprintId: string) => {
    return get().retrospectiveItems.filter((i) => i.sprintId === sprintId);
  },

  addRetroItem: (itemData) => {
    const newItem: RetrospectiveItem = {
      ...itemData,
      id: `retro-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      votes: [],
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      retrospectiveItems: [newItem, ...state.retrospectiveItems],
    }));
    return newItem;
  },

  updateRetroItem: (itemId: string, content: string) => {
    set((state) => ({
      retrospectiveItems: state.retrospectiveItems.map((i) =>
        i.id === itemId ? { ...i, content } : i
      ),
    }));
  },

  deleteRetroItem: (itemId: string) => {
    set((state) => ({
      retrospectiveItems: state.retrospectiveItems.filter((i) => i.id !== itemId),
    }));
  },

  voteRetroItem: (itemId: string, userId: string) => {
    set((state) => ({
      retrospectiveItems: state.retrospectiveItems.map((i) => {
        if (i.id !== itemId) return i;
        const hasVoted = i.votes.includes(userId);
        return {
          ...i,
          votes: hasVoted ? i.votes.filter((id) => id !== userId) : [...i.votes, userId],
        };
      }),
    }));
  },

  updateRetroActionItem: (itemId: string, updates: Partial<RetrospectiveItem>) => {
    set((state) => ({
      retrospectiveItems: state.retrospectiveItems.map((i) =>
        i.id === itemId ? { ...i, ...updates } : i
      ),
    }));
  },

  convertRetroActionToTask: (itemId: string, projectId: string, title: string, assigneeId?: string) => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const project = get().projects.find((p) => p.id === projectId);
    const occupied = new Set(
      get()
        .tasks.filter((t) => t.projectId === projectId)
        .map((t) => getIssueKey(project, t))
    );
    const newTask: Task = {
      id: taskId,
      issueKey: mintIssueKey(getIssueKeyPrefix(project), occupied, `TASK:${title}`),
      projectId,
      title,
      description: `Created from Iteration Retrospective action item.`,
      type: 'TASK',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId,
      createdById: 'u-pm-01',
      tags: ['retrospective', 'action-item'],
      comments: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      tasks: [newTask, ...state.tasks],
      retrospectiveItems: state.retrospectiveItems.map((i) =>
        i.id === itemId
          ? { ...i, convertedTaskId: taskId, actionItemStatus: 'IN_PROGRESS' as RetroActionStatus }
          : i
      ),
      activities: [
        {
          id: `act-${Date.now()}`,
          organizationId: 'org-001',
          userId: 'u-pm-01',
          projectId,
          action: 'converted retrospective action item to task',
          entityType: 'TASK',
          entityId: taskId,
          entityTitle: title,
          createdAt: now,
        },
        ...state.activities,
      ],
    }));

    return newTask;
  },

  updateSprintRetrospective: (sprintId: string, updates: Partial<SprintRetrospective>) => {
    set((state) => {
      const existing = state.retrospectives.find((r) => r.sprintId === sprintId);
      const now = new Date().toISOString();
      if (existing) {
        return {
          retrospectives: state.retrospectives.map((r) =>
            r.sprintId === sprintId
              ? { ...r, ...updates, updatedAt: now }
              : r
          ),
        };
      } else {
        const newRetro: SprintRetrospective = {
          id: `retro-${sprintId}`,
          sprintId,
          projectId: updates.projectId || '',
          status: updates.status || 'DRAFT',
          template: updates.template || 'STANDARD',
          summary: updates.summary || '',
          facilitatorId: updates.facilitatorId || 'u-pm-01',
          conductedDate: updates.conductedDate || now,
          createdAt: now,
          updatedAt: now,
          ...updates,
        };
        return {
          retrospectives: [...state.retrospectives, newRetro],
        };
      }
    });
  },

  // CROSS-PROJECT SPRINT LINKS ACTIONS
  linkSprints: (sourceSprintId, targetSprintId, relationship, currentUserId = 'u-pm-01') => {
    const existing = get().sprintLinks.find(
      (l) => l.sourceSprintId === sourceSprintId && l.targetSprintId === targetSprintId
    );
    if (existing) {
      set((state) => ({
        sprintLinks: state.sprintLinks.map((l) =>
          l.id === existing.id ? { ...l, relationship } : l
        ),
      }));
      return existing;
    }

    const newLink: SprintLink = {
      id: `slink-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceSprintId,
      targetSprintId,
      relationship,
      createdById: currentUserId,
      createdAt: new Date().toISOString(),
    };

    const sourceSprint = get().sprints.find((s) => s.id === sourceSprintId);
    const targetSprint = get().sprints.find((s) => s.id === targetSprintId);

    set((state) => ({
      sprintLinks: [newLink, ...state.sprintLinks],
      activities: [
        {
          id: `act-${Date.now()}`,
          organizationId: 'org-001',
          userId: currentUserId,
          action: `linked sprint ${sourceSprint?.name || sourceSprintId} to ${targetSprint?.name || targetSprintId} (${relationship})`,
          entityType: 'SPRINT',
          entityId: sourceSprintId,
          entityTitle: sourceSprint?.name || 'Sprint',
          createdAt: new Date().toISOString(),
        },
        ...state.activities,
      ],
    }));

    return newLink;
  },

  removeSprintLink: (linkId) => {
    set((state) => ({
      sprintLinks: state.sprintLinks.filter((l) => l.id !== linkId),
    }));
  },

  getSprintLinks: (sprintId) => {
    const { sprintLinks, sprints, projects } = get();
    const results: Array<{
      link: SprintLink;
      otherSprint: Sprint;
      otherProject: Project;
      direction: 'outgoing' | 'incoming';
      isBlocked: boolean;
    }> = [];

    sprintLinks.forEach((link) => {
      if (link.sourceSprintId === sprintId) {
        const otherSprint = sprints.find((s) => s.id === link.targetSprintId);
        if (otherSprint) {
          const otherProject = projects.find((p) => p.id === otherSprint.projectId) || ({
            id: otherSprint.projectId,
            name: 'External Project',
          } as Project);

          const isBlocked =
            link.relationship === 'DEPENDS_ON' && otherSprint.status !== 'COMPLETED';

          results.push({
            link,
            otherSprint,
            otherProject,
            direction: 'outgoing',
            isBlocked,
          });
        }
      } else if (link.targetSprintId === sprintId) {
        const otherSprint = sprints.find((s) => s.id === link.sourceSprintId);
        if (otherSprint) {
          const otherProject = projects.find((p) => p.id === otherSprint.projectId) || ({
            id: otherSprint.projectId,
            name: 'External Project',
          } as Project);

          const isBlocked =
            link.relationship === 'BLOCKS' && otherSprint.status !== 'COMPLETED';

          results.push({
            link,
            otherSprint,
            otherProject,
            direction: 'incoming',
            isBlocked,
          });
        }
      }
    });

    return results;
  },
}));


// Persist custom field definitions + per-issue values across refreshes.
// Deduplicated inside persistCustomFieldSnapshot, so unchanged state never
// touches localStorage.
useAppStore.subscribe((state) => {
  persistCustomFieldSnapshot(state.customFieldDefinitions, state.tasks);
});

// Heal persisted issue-link keys against the identities loaded above: a
// refresh can revert the store while rekeyed links survive in localStorage
// (or the reverse), which would leave links unresolvable. Deferred by one
// microtask so this is safe regardless of module evaluation order around the
// circular issueLinkPersistence import.
queueMicrotask(() => {
  reconcilePersistedIssueLinks(useAppStore.getState().projects);
});
