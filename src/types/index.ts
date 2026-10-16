// ============================================================
// ENUMS
// ============================================================

export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_LEADER' | 'MEMBER';

export type UserStatus = 'INVITATION_PENDING' | 'ACTIVE' | 'INACTIVE';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

/**
 * Issue-type-specific workflow statuses for INITIATIVE work items. Linear chain:
 * BACKLOG -> ASSESSMENT -> ON_BOARD -> READY_FOR_DEVELOPMENT -> IN_DEVELOPMENT ->
 * DEVELOPMENT_COMPLETE -> READY_FOR_DEPLOYMENT -> DEPLOYMENT -> VALIDATION -> COMPLETED.
 * ON_HOLD is a temporary side state, never a step in the chain.
 * Every Initiative always starts at BACKLOG when created.
 */
export type InitiativeWorkflowStatus =
  | 'BACKLOG'
  | 'ASSESSMENT'
  | 'ON_BOARD'
  | 'READY_FOR_DEVELOPMENT'
  | 'IN_DEVELOPMENT'
  | 'DEVELOPMENT_COMPLETE'
  | 'READY_FOR_DEPLOYMENT'
  | 'DEPLOYMENT'
  | 'VALIDATION'
  | 'COMPLETED'
  | 'ON_HOLD';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'BUG_FIX' | 'RETEST' | 'BLOCKED' | 'DONE' | 'CANCELLED' | InitiativeWorkflowStatus;

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'RETESTING' | 'CLOSED' | 'REOPENED';

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type NotificationType =
  | 'INVITATION'
  | 'PROJECT_ASSIGNED'
  | 'TEAM_ASSIGNED'
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'STAGE_CHANGED'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'BUG_REPORTED'
  | 'BUG_ASSIGNED'
  | 'RETEST_REQUIRED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE';

export type WorkflowStageType =
  | 'PLANNING'
  | 'DEVELOPMENT'
  | 'CODE_REVIEW'
  | 'TESTING'
  | 'BUG_FIX'
  | 'RETEST'
  | 'UAT'
  | 'DEPLOYMENT'
  | 'COMPLETED'
  | 'CUSTOM';

export type ReleaseStatus = 'PLANNING' | 'IN_PROGRESS' | 'RELEASED' | 'CANCELLED';

export type DependencyType =
  | 'BLOCKS' | 'BLOCKED_BY'
  | 'CLONES' | 'CLONED_BY'
  | 'SPLIT_TO' | 'SPLIT_FROM'
  | 'MITIGATES' | 'MITIGATED_BY'
  | 'RELATES_TO' | 'RELATES_FROM'
  | 'MENTIONED' | 'MENTIONED_IN';

export type AutomationTrigger =
  | 'TASK_CREATED' | 'TASK_STATUS_CHANGED' | 'TASK_ASSIGNED' | 'TASK_OVERDUE' | 'TASK_DONE'
  | 'SPRINT_STARTED' | 'SPRINT_COMPLETED'
  | 'DEPENDENCY_BLOCKED'
  | 'RELEASE_STARTED' | 'RELEASE_COMPLETED';

export type AutomationAction =
  | 'UPDATE_SPRINT_PROGRESS' | 'NOTIFY_ASSIGNEE' | 'NOTIFY_TEAM_LEAD' | 'UPDATE_PROJECT_PROGRESS'
  | 'CHANGE_STATUS' | 'ASSIGN_USER' | 'ASSIGN_TEAM' | 'CHANGE_PRIORITY'
  | 'ADD_NOTIFICATION' | 'UPDATE_SPRINT' | 'UPDATE_RELEASE' | 'LOG_ACTIVITY';

export type AutomationConditionOperator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';

export type AutomationConditionField = 'status' | 'priority' | 'assigneeId' | 'teamId' | 'sprintId' | 'releaseId' | 'dueDate' | 'storyPoints' | 'type';

export type CustomFieldType =
  | 'text' | 'long_text' | 'number' | 'decimal'
  | 'date' | 'datetime'
  | 'dropdown' | 'multi_select' | 'checkbox'
  | 'url' | 'user' | 'email';

export type SprintIncompleteTaskAction = 'MOVE_TO_NEXT_SPRINT' | 'REMAIN_IN_COMPLETED' | 'MOVE_TO_BACKLOG';

export type InitiativeStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Approval {
  id: string;
  taskId: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  timestamp: string;
}

// ============================================================
// CORE ENTITIES
// ============================================================

export type StoragePlan = 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  storageUsedBytes?: number;
  storageLimitBytes?: number;
  storagePlan?: StoragePlan;
  maxFileSizeLimitBytes?: number;
  perUserStorageLimitBytes?: number;
}

export interface User {
  id: string;
  organizationId: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  teamId?: string;
  avatarUrl?: string;
  avatarColor: string;
  createdAt: string;
  lastActiveAt?: string;
  jobTitle?: string;
  authProvider?: 'PASSWORD' | 'GOOGLE' | 'MICROSOFT' | 'OKTA' | 'SAML';
  ssoExternalId?: string;
  storageUsedBytes?: number;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  teamLeaderId?: string;
  memberIds: string[];
  color: string;
  createdAt: string;
}

export interface WorkflowTransitionRule {
  id: string;
  type: 'restrict' | 'request_input' | 'validate' | 'perform_action';
  title: string;
  description?: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface WorkflowTransition {
  id: string;
  fromStageId: string; // 'START', 'ANY', or stage id
  toStageId: string;   // stage id or 'DONE'
  name: string;
  rules?: WorkflowTransitionRule[];
}

export interface WorkflowStage {
  id: string;
  workflowId: string;
  name: string;
  type: WorkflowStageType;
  order: number;
  teamId?: string;
  teamLeaderId?: string;
  description?: string;
  color: string;
  allowedNextStages: string[]; // stage IDs
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  stages: WorkflowStage[];
  transitions?: WorkflowTransition[];
  nodePositions?: Record<string, { x: number; y: number }>;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  key?: string;
  category?: string;
  organizationId: string;
  name: string;
  description: string;
  type: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  projectManagerId: string;
  workflowId?: string;
  currentStageId?: string;
  teamIds: string[];
  progress: number;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: string;
  /** Optional archive flag (same convention as Sprint.isArchived). Archived
   *  projects are hidden from project lists until restored by an admin. */
  isArchived?: boolean;
  /** Org-default template captured at creation (Admin Settings → Project Defaults). */
  template?: string;
  /** Org-default workflow name captured at creation. */
  defaultWorkflowName?: string;
  /** Org-default priority for new work items in this project. */
  defaultPriority?: Priority;
  /** Org-default issue types enabled for this project. */
  defaultIssueTypes?: WorkItemType[];
}

/**
 * Program Increment (PI) — the parent of every iteration. Hierarchy:
 * Project → PI → Iteration (Sprint) → Work Items. Iterations are never
 * standalone project-level entities; each one points at its parent via
 * Sprint.piId.
 */
export interface ProgramIncrement {
  id: string;
  projectId: string;
  /** PI number within the project, e.g. 30 → displayed as "PI 30". */
  number: number;
  /** Display name, derived as `PI {number}`. */
  name: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  /** Parent PI — every iteration belongs to exactly one Program Increment. */
  piId: string;
  /** PI-scoped number, e.g. "30.4" = PI 30, 4th iteration. Unique per PI. */
  iterationNumber: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  taskIds: string[];
  createdById: string;
  teamLeaderId?: string;
  memberIds?: string[];
  createdAt: string;
  isArchived?: boolean;
}

// ============================================================
// CROSS-PROJECT SPRINT LINKS
// ============================================================

export type SprintLinkRelationship = 'DEPENDS_ON' | 'BLOCKS' | 'ALIGNED_WITH';

export interface SprintLink {
  id: string;
  sourceSprintId: string;
  targetSprintId: string;
  relationship: SprintLinkRelationship;
  createdById: string;
  createdAt: string;
}

// ============================================================
// WORK ITEM HIERARCHY & ISSUE DETAIL FIELDS
// ============================================================

/**
 * Canonical FlowExec work item hierarchy (parent -> child):
 *   Initiative -> Feature -> Epic -> Story / Task / Bug -> Sub-task
 */
export type WorkItemType =
  | 'INITIATIVE'
  | 'FEATURE'
  | 'EPIC'
  | 'STORY'
  | 'TASK'
  | 'SUB-TASK'
  | 'BUG_FIX'
  | 'IMPROVEMENT';

export type IssueResolution =
  | 'FIXED'
  | 'DONE'
  | 'WONT_DO'
  | 'DUPLICATE'
  | 'CANNOT_REPRODUCE'
  | 'CANCELLED';

export type EpicWorkflowStatus = 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export type ProductRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Optional planning / issue-detail fields used by the Initiative, Feature and
 * Epic detail experience. Frontend-only (no backend persistence).
 */
export interface IssueDetailFields {
  reporterId?: string;
  /** Affects Version/s */
  affectsVersions?: string[];
  /** Fix Version/s */
  fixVersions?: string[];
  /** Component/s */
  components?: string[];
  /** Application CI (as per CMDB) - multiple values for Initiatives */
  applicationCis?: string[];
  resolution?: IssueResolution;
  resolvedAt?: string;
  /** Team Name (Feature) */
  teamName?: string;
  /** Definition of Ready met? (Feature) */
  dorMet?: boolean;
  /** Product Risk (Feature) */
  productRisk?: ProductRisk;
  /** Epic Name (Epic) */
  epicName?: string;
  /** Epic Status (Epic) */
  epicStatus?: EpicWorkflowStatus;
  /** Test Case / Acceptance Criteria (Epic) */
  testCase?: string;
  acceptanceCriteria?: string;
  benefitHypothesis?: string;
  /** Users who voted for this issue */
  voterIds?: string[];
  /** Users watching this issue */
  watcherIds?: string[];
}

export interface DescriptionBlock {
  id: string;
  text: string;
  imageUrl?: string;
  imageName?: string;
  imageCaption?: string;
}

export interface Task extends IssueDetailFields {
  id: string;
  /**
   * The issue's real Jira-style key (e.g. "ECOMM-501"), assigned when the issue
   * is created (board issues carry their board key). The internal `id` is a
   * completely separate concept and is NEVER used to build a displayed key.
   */
  issueKey?: string;
  projectId: string;
  sprintId?: string;
  stageId?: string;
  teamId?: string;
  teamLeaderId?: string;
  assigneeId?: string;
  parentId?: string; // id of parent Initiative / Feature / Epic / Task
  createdById: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  descriptionBlocks?: DescriptionBlock[];
  type: WorkItemType;
  status: TaskStatus;
  /**
   * INITIATIVE only: the workflow status the Initiative must resume to. Set
   * when it enters ON_HOLD, cleared when it resumes. Never a second status
   * field — `status` remains the single source of truth.
   */
  initiativePreviousStatus?: InitiativeWorkflowStatus;
  /**
   * INITIATIVE only: ids of Epics explicitly linked to this Initiative
   * (many-to-many, independent of the Initiative -> Feature -> Epic parent
   * chain). Ids are preserved as-is — linking never re-parents or re-keys the
   * Epic, and never copies it across projects. Duplicate ids are prevented at
   * the link helper level (utils/initiativeEpics.ts).
   */
  linkedEpicIds?: string[];
  /**
   * Soft-archive flag following the Sprint/Project convention: archived
   * Initiatives stay in the store (work items and links are kept) but are
   * hidden from the default Initiative lists/boards until restored.
   */
  isArchived?: boolean;
  priority: Priority;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  originalEstimate?: number;
  remainingEstimate?: number;
  loggedHours?: number;
  timeLogs?: TimeLog[];
  storyPoints?: number;
  releaseId?: string;
  isFlagged?: boolean;
  flaggedReason?: string;
  flaggedAt?: string;
  flaggedById?: string;
  tags: string[];
  comments: Comment[];
  attachments: Attachment[];
  /**
   * Status transition history for this work item (task / story / epic / ...),
   * appended in chronological order by the store on every status change.
   * Rendered by the Activity section's Transitions tab on the issue detail page.
   */
  statusTransitions?: StatusTransition[];
  bugId?: string;
  customFieldValues?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Bug {
  id: string;
  projectId: string;
  taskId?: string;
  reportedById: string;
  assignedToId?: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  stageId?: string;
  sprintId?: string;
  steps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  fixedAt?: string;
}

export interface CommentAttachment {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  attachedAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  attachments: CommentAttachment[];
  /**
   * Ids of the members structurally mentioned in `content`
   * (`span[data-mention-id]` atoms inserted by the rich-text editor). Parsed
   * from the HTML when the comment is stored so mention state lives in the
   * comment model, not only in the markup.
   */
  mentionIds?: string[];
}

export type AttachmentSource = 'DIRECT_UPLOAD' | 'CLOUD_LINK';
export type AttachmentCategory = 'SPEC' | 'DESIGN' | 'DELIVERABLE' | 'DOCUMENT' | 'PROOF' | 'OTHER';
export type ExternalCloudProvider = 'GOOGLE_DRIVE' | 'FIGMA' | 'DROPBOX' | 'ONEDRIVE' | 'NOTION' | 'OTHER';

export interface Attachment {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  storageKey?: string; // S3/R2 decoupled path e.g. tenant_org-001/projects/p-1/attachments/...
  source?: AttachmentSource;
  category?: AttachmentCategory;
  externalProvider?: ExternalCloudProvider;
  version?: number;
  description?: string;
}

export interface FileRecord {
  id: string;
  organizationId: string;
  projectId: string;
  taskId?: string;
  bugId?: string;
  uploadedById: string;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  version: number;
  versionGroupId: string;
  isLatestVersion: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  deletedById?: string;
  createdAt: string;
  updatedAt: string;
}

export type FileUploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export interface PendingFile {
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
}

export interface StorageUsageData {
  usedBytes: number;
  quotaBytes: number;
  projectUsedBytes: number;
  projectQuotaBytes: number;
}

export interface Todo {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  priority: Priority;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  taskId?: string;
  projectId?: string;
  source?: 'PERSONAL' | 'ASSIGNED';
  assignedById?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  projectId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface ActivityFilterState {
  projectId: string;
  userId: string;
  teamId: string;
  entityType: string;
  taskId: string;
  sprintId: string;
  releaseId: string;
  datePreset: 'all' | 'today' | '7days' | '30days' | 'custom';
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
}

export const ACTIVITY_TYPE_OPTIONS: { value: string; label: string; category: string }[] = [
  { value: 'TASK_CREATED', label: 'Task Created', category: 'Task' },
  { value: 'TASK_UPDATED', label: 'Task Updated', category: 'Task' },
  { value: 'STATUS_CHANGED', label: 'Status Changed', category: 'Task' },
  { value: 'ASSIGNMENT_CHANGED', label: 'Assignment Changed', category: 'Task' },
  { value: 'COMMENT_ADDED', label: 'Comment Added', category: 'Task' },
  { value: 'SPRINT_STARTED', label: 'Iteration Started', category: 'Iteration' },
  { value: 'SPRINT_COMPLETED', label: 'Iteration Completed', category: 'Iteration' },
  { value: 'RELEASE_CREATED', label: 'Release Created', category: 'Release' },
  { value: 'RELEASE_UPDATED', label: 'Release Updated', category: 'Release' },
  { value: 'DEPENDENCY_ADDED', label: 'Dependency Added', category: 'Dependency' },
  { value: 'DEPENDENCY_REMOVED', label: 'Dependency Removed', category: 'Dependency' },
  { value: 'APPROVAL_REQUESTED', label: 'Approval Requested', category: 'Approval' },
  { value: 'APPROVAL_APPROVED', label: 'Approval Approved', category: 'Approval' },
  { value: 'APPROVAL_REJECTED', label: 'Approval Rejected', category: 'Approval' },
  { value: 'USER_CREATED', label: 'User Created', category: 'Team' },
  { value: 'USER_UPDATED', label: 'User Updated', category: 'Team' },
  { value: 'PROJECT_CREATED', label: 'Project Created', category: 'Project' },
  { value: 'PROJECT_UPDATED', label: 'Project Updated', category: 'Project' },
  { value: 'BUG_CREATED', label: 'Bug Created', category: 'Bug' },
  { value: 'BUG_UPDATED', label: 'Bug Updated', category: 'Bug' },
  { value: 'OTHER', label: 'Other', category: 'Other' },
];

// ============================================================
// AUTH
// ============================================================

export interface AuthUser extends User {
  organization: Organization;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: Role;
  jobTitle?: string;
  teamId?: string;
}

// ============================================================
// UI HELPERS
// ============================================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface FilterState {
  status?: string;
  priority?: string;
  assigneeId?: string;
  teamId?: string;
  stageId?: string;
  sprintId?: string;
  search?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
// ============================================================
// RELEASE MANAGEMENT
// ============================================================

export interface Release {
  id: string;
  projectId: string;
  name: string;
  version: string;
  description?: string;
  startDate: string;
  targetDate: string;
  status: ReleaseStatus;
  taskIds: string[];
  epicIds: string[];
  progress: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TASK DEPENDENCIES
// ============================================================

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
  /** Optional comment captured when the link was created from the Link dialog. */
  comment?: string;
  createdAt: string;
}

// ============================================================
// AUTOMATION RULES
// ============================================================

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  actionConfig?: Record<string, string>;
  enabled: boolean;
  lastExecutedAt?: string;
  executionCount: number;
  preventedCount?: number;
  lastPreventedReason?: string;
  createdAt: string;
}

// ============================================================
// SPRINT REPORT DATA
// ============================================================

export interface SprintReport {
  sprintId: string;
  sprintName: string;
  sprintGoal: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  remainingTasks: number;
  blockedTasks: number;
  completionPercentage: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

// ============================================================
// BURNDOWN / BURNUP DATA POINTS
// ============================================================

export interface ChartDataPoint {
  day: number;
  label: string;
  ideal?: number;
  actual?: number;
  scope?: number;
  completed?: number;
  remaining?: number;
}

// ============================================================
// FILTER STATE (Enhanced)
// ============================================================

export interface EnhancedFilterState extends FilterState {
  epicId?: string;
  releaseId?: string;
  dueDate?: string;
  overdue?: boolean;
  blocked?: boolean;
}

// ============================================================
// TIME TRACKING
// ============================================================

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  description?: string;
  date: string;
  createdAt: string;
}

/**
 * A status as it can appear in a transition record. `CANCELLED` is a real
 * terminal TaskStatus (legacy DONE + resolution CANCELLED issues still map to
 * it for display). The extra custom statuses are Jira-workflow labels that can
 * appear on seeded/demo transition records but are not board columns.
 */
export type TransitionStatus =
  | TaskStatus
  | 'IN TEAM BACKLOG'
  | 'IMPLEMENT'
  | 'FUNNEL';

/**
 * One recorded status change of a work item (task / story / epic / ...).
 * Written by the store whenever a status actually changes, and rendered as a
 * record in the issue detail page's Activity → Transitions tab.
 */
export interface StatusTransition {
  id: string;
  userId: string;
  userName: string;
  /** Avatar image when the user has one; the UI falls back to initials. */
  userAvatar?: string;
  userAvatarColor?: string;
  fromStatus: TransitionStatus;
  toStatus: TransitionStatus;
  changedAt: string;
  /**
   * When the issue entered `fromStatus`. Recorded with the transition so the
   * "Time In Source Status" column stays stable for seeded/demo history;
   * recomputed from the surrounding records when absent.
   */
  sourceEnteredAt?: string;
  /** How long the issue stayed in `fromStatus`, pre-formatted (e.g. "5s", "66d 21h 1m"). */
  timeInSourceStatus: string;
}

// ============================================================
// CUSTOM FIELDS (issue-level custom details)
// ============================================================

/** Stored value for a custom field: string for most types, array for multi-select, boolean for checkbox. */
export type CustomFieldValue = string | string[] | boolean;

/**
 * Admin/PM-defined custom field configuration, scoped to one project.
 * `enabled` is the field's active toggle; `label` is the header shown on the
 * issue (falls back to `name` when unset). `applicableIssueTypes` omitted or
 * empty = applies to every issue type in the project.
 */
export interface CustomFieldDefinition {
  id: string;
  projectId: string;
  name: string;
  label?: string;
  description?: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  enabled: boolean;
  defaultValue?: CustomFieldValue;
  applicableIssueTypes?: WorkItemType[];
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================
// SAVED FILTERS
// ============================================================

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  filters: EnhancedFilterState;
  createdAt: string;
}

// ============================================================
// INITIATIVE (above Epic)
// ============================================================

export interface Initiative {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: InitiativeStatus;
  startDate?: string;
  targetDate?: string;
  epicIds: string[];
  progress: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// SCENARIO PLANNING
// ============================================================

export interface ScenarioChange {
  entityType: 'task' | 'sprint' | 'release';
  entityId: string;
  field: string;
  oldValue: any;
  newValue: any;
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  changes: ScenarioChange[];
  createdById: string;
  createdAt: string;
}

// ============================================================
// SPRINT INCOMPLETE TASK CONFIG
// ============================================================

export interface SprintConfig {
  projectId: string;
  incompleteTaskAction: SprintIncompleteTaskAction;
  updatedAt: string;
}

// ============================================================
// AUTOMATION ENGINE
// ============================================================

export interface AutomationCondition {
  field: AutomationConditionField;
  operator: AutomationConditionOperator;
  value: string;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  triggeredBy: string;
  triggeredEntityType: string;
  triggeredEntityId: string;
  success: boolean;
  message?: string;
  executedAt: string;
}

// ============================================================
// VELOCITY DATA (Enhanced)
// ============================================================

export interface VelocityData {
  sprintId: string;
  sprintName: string;
  plannedTasks: number;
  completedTasks: number;
  plannedPoints: number;
  completedPoints: number;
  velocity: number;
}

// ============================================================
// OVERDUE CALCULATION
// ============================================================

export interface OverdueInfo {
  taskId: string;
  isOverdue: boolean;
  daysOverdue: number;
  dueDate: string;
}

// ============================================================
// LIVE TIMER
// ============================================================

export interface ActiveTimer {
  taskId: string;
  userId: string;
  startedAt: string;
  projectId: string;
}

// ============================================================
// AUTOMATION LOOP PREVENTION
// ============================================================

export interface AutomationExecutionContext {
  executionId: string;
  triggerChain: string[];
  depth: number;
  maxDepth: number;
  executedRules: Set<string>;
  entityHistory: string[];
}

// ============================================================
// SPRINT RETROSPECTIVE
// ============================================================

export type RetrospectiveTemplate = 'STANDARD' | 'START_STOP_CONTINUE' | 'FOUR_LS';

export type RetrospectiveCategory =
  | 'WHAT_WENT_WELL'
  | 'NEEDS_IMPROVEMENT'
  | 'ACTION_ITEMS'
  | 'KUDOS'
  | 'START'
  | 'STOP'
  | 'CONTINUE'
  | 'LIKED'
  | 'LEARNED'
  | 'LACKED'
  | 'LONGED_FOR';

export type RetrospectiveStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export type RetroActionStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface RetrospectiveItem {
  id: string;
  sprintId: string;
  projectId: string;
  category: RetrospectiveCategory;
  content: string;
  authorId: string;
  authorName: string;
  isAnonymous?: boolean;
  votes: string[]; // user IDs who upvoted
  actionItemStatus?: RetroActionStatus;
  actionAssigneeId?: string;
  actionDueDate?: string;
  convertedTaskId?: string;
  createdAt: string;
}

export interface SprintRetrospective {
  id: string;
  sprintId: string;
  projectId: string;
  status: RetrospectiveStatus;
  template: RetrospectiveTemplate;
  summary?: string;
  facilitatorId?: string;
  conductedDate?: string;
  updatedAt: string;
  createdAt: string;
}

export * from './sso';
export * from './chat';

