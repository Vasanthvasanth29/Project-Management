import type { AuthUser, Project, Priority, Sprint, Task, TaskStatus, Team, User, IssueResolution } from '../types';
import { useAppStore } from '../store/appStore';
import { matchId } from './idUtils';
import { getIssueKeyPrefix } from './projectIdentity';
import { synthesizeTransitionHistory } from './statusTransitions';

// One row of an expandable iteration section, as rendered on the Iterations page.
// Shared so the Issue Search page shows exactly the same issue records and counts.
export interface IterationIssue {
  id: string;
  key: string;
  title: string;
  type: 'STORY' | 'TASK' | 'BUG' | 'EPIC';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: TaskStatus;
  /** Terminal resolution (CANCELLED keeps showing Cancelled everywhere). */
  resolution?: IssueResolution;
  releaseTag: string;
  epicName: string;
  epicColor: string;
  assigneeName: string;
  assigneeInitial: string;
  assigneeAvatarColor: string;
  avatarUrl?: string;
  storyPoints: number;
  updatedDate: string;
}

// Epic badge palette generator
const EPIC_COLORS = [
  'bg-[#433827] text-[#fcd34d] border-[#785d26]', // Amber/Brown
  'bg-[#b45309] text-white border-[#92400e]',       // Orange
  'bg-[#86198f] text-white border-[#701a75]',       // Purple
  'bg-[#be123c] text-white border-[#9f1239]',       // Rose
  'bg-[#c2410c] text-white border-[#9a3412]',       // Dark Orange
  'bg-[#1d4ed8] text-white border-[#1e40af]',       // Blue
  'bg-[#0369a1] text-white border-[#075985]',       // Cyan
  'bg-[#047857] text-white border-[#065f46]',       // Emerald
];

export const getEpicColor = (epicName: string): string => {
  let hash = 0;
  for (let i = 0; i < epicName.length; i++) {
    hash = (hash << 5) - hash + epicName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % EPIC_COLORS.length;
  return EPIC_COLORS[index];
};

// Display order for a project's iterations: active first, then upcoming chronologically,
// then completed (most recent first) — the reference backlog order. Issue keys are
// namespaced by this index, so every consumer must sort identically.
export const sortProjectSprints = (sprints: Sprint[], projectId: string): Sprint[] => {
  const statusRank = (s: Sprint) => (s.status === 'ACTIVE' ? 0 : s.status === 'PLANNED' ? 1 : 2);
  return sprints
    .filter((s) => s.projectId === projectId && !s.isArchived)
    .sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      const startA = new Date(a.startDate).getTime();
      const startB = new Date(b.startDate).getTime();
      return a.status === 'COMPLETED' ? startB - startA : startA - startB;
    });
};

// Members shown on an iteration row: the sprint roster when set, otherwise the
// project team — never fabricated names.
export const buildProjectTeamMembers = (
  project: Project | undefined | null,
  teams: Team[],
  users: User[]
): User[] => {
  const teamIds = project?.teamIds || [];
  const relTeams = teams.filter((t) => teamIds.includes(t.id));
  const memberIds = [...new Set(relTeams.flatMap((t) => t.memberIds))];
  const teamUsers = users.filter((u) => memberIds.includes(u.id) || u.id === project?.projectManagerId);

  if (teamUsers.length > 0) {
    return teamUsers;
  }
  // Fallback users if no specific team is attached
  return users.slice(0, 15);
};

// Per-iteration issue lists: the sprint's real work items first, topped up with
// domain seed items so every expandable iteration section renders with realistic
// volume (matches the single-sprint behaviour this replaces).
export const buildSprintIssuesMap = (params: {
  tasks: Task[];
  users: User[];
  project?: Project | null;
  projectId: string;
  projectKey: string;
  projectTeamMembers: User[];
  projectSprints: Sprint[];
}): Record<string, IterationIssue[]> => {
  const { tasks, users, project, projectId, projectKey, projectTeamMembers, projectSprints } = params;
  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  // Domain templates for common project types
  const isHealthcare = project?.category?.toLowerCase().includes('health') || project?.name?.toLowerCase().includes('hospital');
  const isEcommerce = project?.category?.toLowerCase().includes('retail') || project?.name?.toLowerCase().includes('e-commerce') || project?.name?.toLowerCase().includes('commerce');

  const domainEpics = isHealthcare
    ? ['Patient Records', 'Doctor Scheduling', 'Billing & Claims', 'Pharmacy & Lab', 'EMR Integration']
    : isEcommerce
    ? ['Checkout & Cart', 'Product Catalog', 'Payment Gateway', 'Order Processing', 'Search & Discovery']
    : ['Core Platform', 'Security & IAM', 'Workflow Engine', 'Integration APIs', 'Analytics & Reporting'];

  const domainSeedData: { title: string; epic: string; points: number; status: TaskStatus; priority: Priority; assignee: string }[] = isHealthcare
    ? [
        { title: 'Patient Registration & Insurance Eligibility API Verification', epic: 'Patient Records', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Doctor Appointment Scheduling & Calendar Double-Booking Guard', epic: 'Doctor Scheduling', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Alex Chen' },
        { title: 'Electronic Health Record (EHR) Clinical Encounter Notes Editor', epic: 'Patient Records', points: 5, status: 'DONE', priority: 'HIGH', assignee: 'Marcus Vance' },
        { title: 'Inpatient Ward Bed Allocation & Census Real-time Tracker', epic: 'Doctor Scheduling', points: 1, status: 'DONE', priority: 'MEDIUM', assignee: 'Elena Rostova' },
        { title: 'Pharmacy Medication Dispense & Drug Allergy Cross-Checking', epic: 'Pharmacy & Lab', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Laboratory Test Orders & HL7 Pathology Results Ingestion', epic: 'Pharmacy & Lab', points: 2, status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'David Kim' },
        { title: 'Medical Insurance Claim Scrubber & Denial Management Flow', epic: 'Billing & Claims', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Maya Patel' },
        { title: 'ICD-10 Diagnostic Coding Auto-Suggester & Compliance Validator', epic: 'Billing & Claims', points: 5, status: 'DONE', priority: 'MEDIUM', assignee: 'Liam O\'Connor' },
        { title: 'Emergency Room Triage Assessment & Vital Signs Telemetry', epic: 'EMR Integration', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Alex Chen' },
        { title: 'Audit Trail Export for HIPAA Compliance Inspection', epic: 'Core Platform', points: 1, status: 'DONE', priority: 'LOW', assignee: 'David Kim' },
        { title: 'Patient Portal Mobile Tele-Consultation Video Session WebRTC', epic: 'EMR Integration', points: 1, status: 'TODO', priority: 'LOW', assignee: 'Marcus Vance' },
        { title: 'Prescription PDF Barcode Generation for In-House Dispensary', epic: 'Pharmacy & Lab', points: 2, status: 'TODO', priority: 'MEDIUM', assignee: 'Priya Sharma' }
      ]
    : isEcommerce
    ? [
        { title: 'Product Search Algolia Indexing & Autocomplete Suggestions', epic: 'Search & Discovery', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Shopping Cart Redis Caching & Guest Session Merge on Login', epic: 'Checkout & Cart', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Checkout Multi-Step Shipping Address & Tax Rates Engine', epic: 'Checkout & Cart', points: 5, status: 'DONE', priority: 'HIGH', assignee: 'Marcus Vance' },
        { title: 'Stripe & PayPal Webhook Idempotency & Signature Verification', epic: 'Payment Gateway', points: 1, status: 'DONE', priority: 'MEDIUM', assignee: 'Elena Rostova' },
        { title: 'Inventory Real-Time Reservation & Stock Lock During Checkout', epic: 'Order Processing', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Promotional Coupon Engine & Stackable Discount Validation', epic: 'Checkout & Cart', points: 2, status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'Alex Chen' },
        { title: 'Order Confirmation Email Dispatch with Dynamic Invoice PDF', epic: 'Order Processing', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Maya Patel' },
        { title: 'Customer Address Autocomplete with Google Places Geocoding', epic: 'Checkout & Cart', points: 5, status: 'DONE', priority: 'MEDIUM', assignee: 'Liam O\'Connor' },
        { title: 'GraphQL Federation Service for Catalog & Price Matrix', epic: 'Product Catalog', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Alex Chen' },
        { title: 'Product Image WebP CDN Optimization & Thumbnail Pipeline', epic: 'Product Catalog', points: 1, status: 'DONE', priority: 'LOW', assignee: 'David Kim' },
        { title: 'Returns & Refund Automation Flow with Carrier Label Generation', epic: 'Order Processing', points: 1, status: 'TODO', priority: 'LOW', assignee: 'Marcus Vance' },
        { title: 'Single Sign-On (SSO) Session Revocation on Security Password Reset', epic: 'Core Platform', points: 2, status: 'TODO', priority: 'MEDIUM', assignee: 'Elena Rostova' }
      ]
    : [
        { title: 'Platform Architecture & Microservice Gateway Mesh Routing', epic: 'Core Platform', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'OAuth 2.0 PKCE Authorization & Session State Validation', epic: 'Security & IAM', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Workflow Stage Transitions & Approval Engine Enforcement', epic: 'Workflow Engine', points: 5, status: 'DONE', priority: 'HIGH', assignee: 'Marcus Vance' },
        { title: 'Database Migration & Partitioning Strategy for Historical Logs', epic: 'Core Platform', points: 1, status: 'DONE', priority: 'MEDIUM', assignee: 'Elena Rostova' },
        { title: 'RESTful API Rate Limiter & Token Bucket Throttling Policy', epic: 'Integration APIs', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Priya Sharma' },
        { title: 'Real-Time WebSocket Notification Bus for Team Mentions', epic: 'Workflow Engine', points: 2, status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'Alex Chen' },
        { title: 'Executive Delivery Dashboard & SLA Variance Metric Engine', epic: 'Analytics & Reporting', points: 3, status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'Maya Patel' },
        { title: 'Role-Based Access Control (RBAC) Fine-Grained Permission Matrix', epic: 'Security & IAM', points: 5, status: 'DONE', priority: 'MEDIUM', assignee: 'Liam O\'Connor' },
        { title: 'Kafka Event Consumer for Cross-Service Audit Log Persistence', epic: 'Integration APIs', points: 3, status: 'DONE', priority: 'HIGH', assignee: 'Alex Chen' },
        { title: 'Healthcheck Endpoint & Prometheus Telemetry Metric Scraper', epic: 'Core Platform', points: 1, status: 'DONE', priority: 'LOW', assignee: 'David Kim' },
        { title: 'Data Retention Policy Automated Archival & S3 Deep Storage', epic: 'Core Platform', points: 1, status: 'TODO', priority: 'LOW', assignee: 'Marcus Vance' },
        { title: 'Automated CI/CD Deployment Smoke Test Suite Integration', epic: 'Integration APIs', points: 2, status: 'TODO', priority: 'MEDIUM', assignee: 'Elena Rostova' }
      ];

  const map: Record<string, IterationIssue[]> = {};

  // Shared workflow state for issues that are not store tasks yet — the same
  // maps the Live Iteration board and the Iteration Board read/write, so an issue
  // moved (or cancelled) on a board already shows that status here. Assignee
  // overrides from the transition dialog are applied the same way.
  const { issueStatusOverrides, issueResolutions, issueAssigneeOverrides } = useAppStore.getState();

  projectSprints.forEach((sprint, sprintIndex) => {
    const sprintTasks = projectTasks.filter((t) => t.sprintId === sprint.id);
    // Issue keys are namespaced per iteration so two expanded iterations can
    // never render colliding keys.
    const keyBase = sprintIndex * 1000;
    const result: IterationIssue[] = [];
    // A materialised seed issue exists BOTH as a store Task and as its domain
    // seed row (same title, same public key). Only one row may render, and it
    // must be the store-task row so the board, the iteration list and the
    // issue detail page all read the single canonical record.
    const claimedTitles = new Set<string>();

    // Map existing sprint tasks first
    sprintTasks.forEach((t, index) => {
      const assignee = users.find((u) => u.id === (issueAssigneeOverrides[t.id] ?? t.assigneeId));
      const epic = domainEpics[index % domainEpics.length];
      const keyNum = keyBase + 100 + index;
      claimedTitles.add(t.title.trim().toLowerCase());
      result.push({
        id: t.id,
        // The issue's own public key (materialised board key / created key)
        // wins, so the key never changes when an issue is opened.
        key: t.issueKey || `${projectKey}-${keyNum}`,
        title: t.title,
        type: t.type === 'BUG_FIX' ? 'BUG' : t.type === 'EPIC' ? 'EPIC' : 'STORY',
        priority: t.priority,
        status: t.status,
        resolution: t.status === 'DONE' ? t.resolution : undefined,
        releaseTag: `${projectKey} PI24`,
        epicName: epic,
        epicColor: getEpicColor(epic),
        assigneeName: assignee ? assignee.name : 'Unassigned',
        assigneeInitial: assignee ? assignee.name[0] : 'U',
        assigneeAvatarColor: assignee?.avatarColor || '#3b82f6',
        avatarUrl: assignee?.avatarUrl,
        storyPoints: t.storyPoints || 3,
        updatedDate: t.completedAt ? t.completedAt.split('T')[0] : '2026-09-08'
      });
    });

    // Supplement with domain seed items to reach rich production iteration volume
    domainSeedData.forEach((seed, idx) => {
      if (result.length >= 14) return;
      const seedId = `gen-${projectKey}-${sprintIndex}-${idx}`;
      if (claimedTitles.has(seed.title.trim().toLowerCase())) return;
      const keyNum = keyBase + 500 + idx;
      // An assignee chosen in the transition dialog overrides the seeded member
      // (including "Unassigned" — an explicit empty override).
      const overridden = Object.prototype.hasOwnProperty.call(issueAssigneeOverrides, seedId);
      const assigneeUser = overridden
        ? users.find((u) => u.id === issueAssigneeOverrides[seedId])
        : projectTeamMembers[idx % projectTeamMembers.length];
      const status = issueStatusOverrides[seedId] ?? seed.status;
      result.push({
        id: seedId,
        key: `${projectKey}-${keyNum}`,
        title: seed.title,
        type: 'STORY',
        priority: seed.priority,
        status,
        resolution: status === 'DONE' ? issueResolutions[seedId] : undefined,
        releaseTag: `${projectKey} PI24`,
        epicName: seed.epic,
        epicColor: getEpicColor(seed.epic),
        assigneeName: overridden ? assigneeUser?.name || 'Unassigned' : assigneeUser ? assigneeUser.name : seed.assignee,
        assigneeInitial: overridden ? assigneeUser?.name[0] || 'U' : assigneeUser ? assigneeUser.name[0] : seed.assignee[0],
        assigneeAvatarColor: assigneeUser?.avatarColor || '#0284c7',
        avatarUrl: assigneeUser?.avatarUrl,
        storyPoints: seed.points,
        updatedDate: '2026-09-08'
      });
    });

    map[sprint.id] = result;
  });

  return map;
};

/**
 * Resolve the task-detail target for an iteration issue row.
 * Existing store tasks are returned directly; seed issues are materialised into real
 * work items (creating the Epic -> Story parents on demand) exactly like the
 * Iterations page does, so both entry points share one task-detail behaviour.
 */
export const resolveIssueTaskId = (params: {
  issue: IterationIssue;
  projectId: string;
  sprintId?: string;
  users: User[];
  currentUser?: AuthUser | null;
}): string => {
  const { issue, projectId, sprintId, users, currentUser } = params;
  const store = useAppStore.getState();

  // Exact-issue lookup, in order of certainty:
  //  1. the row IS a store task (its id was used as the row id),
  //  2. a task already carries this issue's public key (opened before),
  //  3. same title in the same sprint (or a task not yet placed in a sprint).
  // Title matching across sprints is deliberately NOT enough: two iterations
  // can hold same-titled seed issues and each must open its own record.
  const existing =
    store.tasks.find((t) => matchId(t.id, issue.id)) ||
    store.tasks.find((t) => (t.issueKey || '').toUpperCase() === issue.key.toUpperCase()) ||
    store.tasks.find(
      (t) =>
        t.projectId === projectId &&
        t.title.toLowerCase() === issue.title.toLowerCase() &&
        (!sprintId || !t.sprintId || t.sprintId === sprintId)
    );
  if (existing) return existing.id;

  const targetSprint =
    (sprintId && store.sprints.find((s) => s.id === sprintId)) ||
    store.sprints.find((s) => s.projectId === projectId);

  // Find an existing Epic task matching this issue's epic name, or create one, so the
  // child task's parent hierarchy is resolved from real data.
  const resolveEpicParentId = (epicName: string): string | undefined => {
    if (!epicName) return undefined;
    // Read the freshest store snapshot so records created earlier in this same handler
    // (epic, then story) are visible to the lookups that follow.
    const currentTasks = useAppStore.getState().tasks;
    const existingEpic = currentTasks.find(
      (t) => t.projectId === projectId && t.type === 'EPIC' && t.title.toLowerCase() === epicName.toLowerCase()
    );
    if (existingEpic) return existingEpic.id;
    const createdEpic = store.createTask({
      projectId,
      title: epicName,
      description: `Epic grouping delivery work for ${epicName}.`,
      type: 'EPIC',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdById: currentUser?.id || 'u-pm-01',
    });
    return createdEpic.id;
  };

  // The real hierarchy is Epic -> Story -> Task, so a task must never be stored
  // directly on the epic: it attaches to the story under that epic.
  const resolveStoryParentId = (epicName: string): string | undefined => {
    const epicId = resolveEpicParentId(epicName);
    if (!epicId) return undefined;
    const currentTasks = useAppStore.getState().tasks;
    const existingStory = currentTasks.find(
      (t) => t.projectId === projectId && t.type === 'STORY' && t.parentId === epicId
    );
    if (existingStory) return existingStory.id;
    const createdStory = store.createTask({
      projectId,
      parentId: epicId,
      title: `${epicName} Delivery`,
      description: `Story grouping implementation tasks for ${epicName}.`,
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdById: currentUser?.id || 'u-pm-01',
    });
    return createdStory.id;
  };

  // Honour an assignee override from the transition dialog first (including an
  // explicit "Unassigned"), else the row's assignee, else the first member.
  const overrideAssigneeId = store.issueAssigneeOverrides[issue.id];
  const assignedUser =
    overrideAssigneeId !== undefined
      ? users.find((u) => u.id === overrideAssigneeId)
      : users.find((u) => u.name === issue.assigneeName) || users[0];
  const assigneeId =
    overrideAssigneeId === '' ? undefined : assignedUser?.id;
  const parentId = issue.type === 'EPIC' ? undefined : resolveStoryParentId(issue.epicName);
  // Carry the issue's live workflow state onto the materialised record: status
  // overrides (incl. CANCELLED), its comments and its recorded transitions must
  // not be lost the moment a seed issue becomes a real Task. Work Items with no
  // recorded history yet get a realistic one derived from their own status and
  // dates, so the Transitions tab is populated exactly like a runtime-moved issue.
  const liveStatus = store.issueStatusOverrides[issue.id] ?? issue.status;
  const liveResolution =
    liveStatus === 'DONE'
      ? store.issueResolutions[issue.id]
      : undefined;
  const recordedHistory = store.issueStatusTransitions[issue.id] ?? [];
  const statusTransitions =
    recordedHistory.length > 0
      ? recordedHistory
      : (() => {
          // Anchor the history inside the sprint window so the records read
          // like real work in that iteration (seed issues carry no creation
          // date of their own).
          const startDate = targetSprint?.startDate || issue.updatedDate;
          const endDate = targetSprint?.endDate || issue.updatedDate;
          return synthesizeTransitionHistory({
            createdAt: `${startDate}T09:00:00.000Z`,
            status: liveStatus,
            completedAt: liveStatus === 'DONE' ? `${endDate}T16:00:00.000Z` : undefined,
            updatedAt: `${endDate}T16:00:00.000Z`,
            createdById: currentUser?.id || 'u-pm-01',
            assigneeId: assigneeId,
            users,
          });
        })();
  const created = store.createTask({
    projectId,
    // The issue's REAL Jira key (the board/iteration key, e.g. ECOMM-501) is
    // stored on the record so every surface shows the same key as the URL.
    issueKey: issue.key,
    sprintId: targetSprint?.id,
    parentId,
    title: issue.title,
    description: `Implementation specification and deliverables for ${issue.title} under epic ${issue.epicName}.`,
    type: issue.type === 'BUG' ? 'BUG_FIX' : issue.type === 'EPIC' ? 'EPIC' : 'TASK',
    status: liveStatus,
    resolution: liveResolution,
    priority: issue.priority,
    assigneeId: assignedUser?.id,
    createdById: currentUser?.id || 'u-pm-01',
    storyPoints: issue.storyPoints,
    dueDate: targetSprint?.endDate || '2024-09-28',
    comments: store.issueComments[issue.id] ?? [],
    statusTransitions,
  });
  return created.id;
};

/**
 * Task-shaped cards for the seed issues of one iteration so the Iteration Board renders
 * exactly the same work items as the Live Iteration page. These records are never
 * written to the store: status, terminal resolution and comments for them live in
 * `issueStatusOverrides`, `issueResolutions` and `issueComments`.
 */
export interface SprintBoardTask extends Task {
  /** Jira-style key shown on the card; store tasks fall back to their id. */
  issueKey?: string;
}

export const buildSprintBoardTasks = (params: {
  issues: IterationIssue[];
  storeTasks: Task[];
  projectId: string;
  sprintId: string;
  users: User[];
  issueStatusOverrides?: Record<string, TaskStatus>;
  issueResolutions?: Record<string, IssueResolution>;
  issueAssigneeOverrides?: Record<string, string>;
}): SprintBoardTask[] => {
  const {
    issues, storeTasks, projectId, sprintId, users,
    issueStatusOverrides = {}, issueResolutions = {}, issueAssigneeOverrides = {},
  } = params;
  const storeIds = new Set(storeTasks.map((t) => t.id));

  return issues
    .filter((issue) => !storeIds.has(issue.id))
    .map((issue) => {
      const assignee = Object.prototype.hasOwnProperty.call(issueAssigneeOverrides, issue.id)
        ? users.find((u) => u.id === issueAssigneeOverrides[issue.id])
        : users.find((u) => u.name === issue.assigneeName);
      const status = issueStatusOverrides[issue.id] ?? issue.status;
      const resolution = status === 'DONE' ? issueResolutions[issue.id] : undefined;
      return {
        id: issue.id,
        issueKey: issue.key,
        projectId,
        sprintId,
        assigneeId: assignee?.id,
        createdById: assignee?.id || users[0]?.id || '',
        title: issue.title,
        description: '',
        epicName: issue.epicName,
        type: issue.type === 'BUG' ? 'BUG_FIX' : issue.type,
        status,
        priority: issue.priority,
        storyPoints: issue.storyPoints,
        resolution,
        resolvedAt: resolution ? new Date().toISOString() : undefined,
        tags: [],
        comments: [],
        attachments: [],
        createdAt: `${issue.updatedDate}T00:00:00.000Z`,
        updatedAt: `${issue.updatedDate}T00:00:00.000Z`,
        completedAt: status === 'DONE' ? `${issue.updatedDate}T16:00:00.000Z` : undefined,
      };
    });
};

/**
 * Everything a sprint-scoped view must count: the sprint's real store Tasks plus
 * its seed issues shaped as task cards (status / resolution / comments already
 * applied from the shared override maps). Iteration Summary, Burndown, Burnup and
 * the board all read the same work-item list, so a seed-only iteration never
 * renders as empty.
 */
export const collectSprintWorkItems = (params: { sprintId: string; projectId: string }): Task[] => {
  const { sprintId, projectId } = params;
  const store = useAppStore.getState();
  const storeTasks = store.tasks.filter((t) => t.sprintId === sprintId);
  const project = store.projects.find((p) => p.id === projectId) || null;
  const projectSprints = sortProjectSprints(store.sprints, projectId);
  if (!project || projectSprints.length === 0) return storeTasks;

  const issuesBySprint = buildSprintIssuesMap({
    tasks: store.tasks,
    users: store.users,
    project,
    projectId: project.id,
    projectKey: getIssueKeyPrefix(project) || 'PRJ',
    projectTeamMembers: buildProjectTeamMembers(project, store.teams, store.users),
    projectSprints,
  });

  const seedCards = buildSprintBoardTasks({
    issues: issuesBySprint[sprintId] || [],
    storeTasks,
    projectId,
    sprintId,
    users: store.users,
    issueStatusOverrides: store.issueStatusOverrides,
    issueResolutions: store.issueResolutions,
    issueAssigneeOverrides: store.issueAssigneeOverrides,
  });

  return [...storeTasks, ...seedCards];
};
