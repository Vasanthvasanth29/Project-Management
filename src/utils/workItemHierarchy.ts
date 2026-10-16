import type { Task, WorkItemType, Project } from '../types';
import { getIssueKeyPrefix, rekeyIssueKey } from './projectIdentity';

/**
 * FlowExec work item hierarchy:
 *
 *   Initiative
 *      └── Feature
 *            └── Epic
 *                  └── Story / Task / Bug
 *                        └── Sub-task
 *
 * These helpers keep parent/child validation consistent across every surface
 * (detail page, create modal, move modal, lists).
 */

export const WORK_ITEM_TYPE_LABEL: Record<WorkItemType, string> = {
  INITIATIVE: 'Initiative',
  FEATURE: 'Feature',
  EPIC: 'Epic',
  STORY: 'Story',
  TASK: 'Task',
  'SUB-TASK': 'Sub-task',
  BUG_FIX: 'Bug Fix',
  IMPROVEMENT: 'Improvement',
};

/** 0 = top-level planning item ... 4 = lowest level of the hierarchy */
export const WORK_ITEM_LEVEL: Record<WorkItemType, number> = {
  INITIATIVE: 0,
  FEATURE: 1,
  EPIC: 2,
  STORY: 3,
  TASK: 3,
  BUG_FIX: 3,
  IMPROVEMENT: 3,
  'SUB-TASK': 4,
};

/** Allowed child types for a given parent type */
export const WORK_ITEM_CHILDREN: Record<WorkItemType, WorkItemType[]> = {
  INITIATIVE: ['FEATURE'],
  FEATURE: ['EPIC'],
  EPIC: ['STORY', 'TASK', 'BUG_FIX', 'IMPROVEMENT'],
  STORY: ['SUB-TASK'],
  TASK: ['SUB-TASK'],
  BUG_FIX: ['SUB-TASK'],
  IMPROVEMENT: ['SUB-TASK'],
  'SUB-TASK': [],
};

/** Allowed parent types for a given child type */
export const WORK_ITEM_PARENTS: Record<WorkItemType, WorkItemType[]> = {
  INITIATIVE: [],
  FEATURE: ['INITIATIVE'],
  EPIC: ['FEATURE'],
  STORY: ['EPIC'],
  TASK: ['EPIC'],
  BUG_FIX: ['EPIC'],
  IMPROVEMENT: ['EPIC'],
  'SUB-TASK': ['TASK', 'STORY', 'BUG_FIX', 'IMPROVEMENT'],
};

/** Work item types that can be created without a parent */
export const ROOT_CREATABLE_TYPES: WorkItemType[] = [
  'INITIATIVE',
  'FEATURE',
  'EPIC',
  'STORY',
  'TASK',
  'BUG_FIX',
  'IMPROVEMENT',
];

export function getWorkItemLabel(type: WorkItemType | string | undefined): string {
  if (!type) return 'Work Item';
  return WORK_ITEM_TYPE_LABEL[type as WorkItemType] || String(type);
}

/** True when `childType` is a valid child of `parentType`. */
export function isValidParentChild(parentType: WorkItemType, childType: WorkItemType): boolean {
  return WORK_ITEM_CHILDREN[parentType]?.includes(childType) ?? false;
}

/** Child types offered when creating from a parent's context. */
export function getAllowedChildTypes(parentType: WorkItemType | undefined): WorkItemType[] {
  if (!parentType) return ROOT_CREATABLE_TYPES;
  return WORK_ITEM_CHILDREN[parentType] ?? [];
}

/** Parent types that may contain `childType`. */
export function getAllowedParentTypes(childType: WorkItemType): WorkItemType[] {
  return WORK_ITEM_PARENTS[childType] ?? [];
}

export function canHaveChildren(type: WorkItemType): boolean {
  return (WORK_ITEM_CHILDREN[type]?.length ?? 0) > 0;
}

/**
 * Numeric band used when an issue needs a key but has no board/iteration key
 * and no seeded numeric suffix (runtime-created issues). The band sits inside
 * the per-iteration key space the board never occupies (board keys use
 * ..100-114, ..500-511 and ..900+ of each 1000-block, seeds use low numbers).
 */
const MINT_MIN = 520;
const MINT_MAX = 899;

/**
 * Deterministic Jira-style key for an issue with no natural key, derived from
 * the issue's OWN content (type + title) — never from the internal Task id, so
 * the same issue shows the same key in every session. `occupied` holds keys
 * already used in the project so two issues can never share a key.
 */
export function mintIssueKey(
  projectKey: string | undefined | null,
  occupied: Set<string>,
  content: string
): string {
  const prefix = (projectKey || 'FE').toUpperCase();
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
  }
  const span = MINT_MAX - MINT_MIN + 1;
  for (let i = 0; i < span; i++) {
    const key = `${prefix}-${MINT_MIN + ((hash + i) % span)}`;
    if (!occupied.has(key)) return key;
  }
  return `${prefix}-${MINT_MIN + (hash % span)}`;
}

/**
 * Human friendly issue key, e.g. `ET-030` / `ECOMM-001`.
 *
 * One deterministic source of truth for Jira-style keys, resolved in order:
 *   1. `task.issueKey` — the key assigned to the issue when it was created.
 *   2. The seeded numeric suffix of seed data (`task-003` -> `ECOMM-003`),
 *      which is how seed issues have always been keyed in this app.
 *   3. A content-derived key (`mintIssueKey`).
 *
 * The internal/materialized Task id is never turned into a displayed key.
 */
export function getIssueKey(project: Project | undefined | null, task: Task): string {
  // Issue prefix is always derived from the project's CURRENT key (see
  // utils/projectIdentity.ts) — never a hardcoded prefix, and a stored key
  // re-issues under the current prefix so renames update it immediately.
  const prefix = getIssueKeyPrefix(project) || 'FE';

  // The explicit key that belongs to this issue (board issues store theirs here).
  if (task.issueKey) return rekeyIssueKey(prefix, task.issueKey);

  // Seeded items keep their padded numeric suffix (init-030 -> ET-030).
  const raw = task.id.replace(/^[a-z]+-/i, '');
  if (/^\d+$/.test(raw)) return `${prefix}-${raw}`;

  // Runtime issues always carry `issueKey`; this content-derived fallback only
  // covers records created outside `createTask` (e.g. retrospective items).
  return mintIssueKey(prefix, new Set(), `${task.type}:${task.title}`);
}

/** Jira-style label for the parent relationship of an issue. */
export function getParentFieldLabel(type: WorkItemType): string {
  switch (type) {
    case 'FEATURE':
      return 'Initiative';
    case 'EPIC':
      return 'Feature';
    case 'SUB-TASK':
      return 'Parent Task';
    default:
      return 'Parent';
  }
}

/**
 * Parent levels accepted by the type-aware "Parent Link" field, following the
 * existing hierarchy one level at a time:
 *
 *   Task   -> Story
 *   Story  -> Epic
 *   Epic   -> Feature
 *
 * Sub-tasks and bugs keep their existing allowed parents (Task/Story/... and
 * Story/Epic), and a Feature resolves to its Initiative. Types absent from this
 * map have no parent-link level (nothing is invented for them).
 */
export const PARENT_LINK_TYPES: Partial<Record<WorkItemType, WorkItemType[]>> = {
  TASK: ['STORY'],
  STORY: ['EPIC'],
  EPIC: ['FEATURE'],
  FEATURE: ['INITIATIVE'],
  BUG_FIX: ['STORY', 'EPIC'],
  IMPROVEMENT: ['STORY', 'EPIC'],
  'SUB-TASK': ['TASK', 'STORY', 'BUG_FIX', 'IMPROVEMENT'],
};

/**
 * Type-aware parent for the "Parent Link" field: walks the EXISTING parentId
 * chain and returns the nearest ancestor whose type is a valid parent level
 * for `task.type`. Returns undefined (rendered as "—") when no such ancestor
 * exists — a parent is never fabricated and an ancestor of the wrong type is
 * never shown.
 */
export function resolveParentLink(allTasks: Task[], task: Task): Task | undefined {
  const accepted = PARENT_LINK_TYPES[task.type];
  if (!accepted || accepted.length === 0) return undefined;

  const byId = new Map(allTasks.map((t) => [t.id, t] as const));
  let current = task.parentId ? byId.get(task.parentId) : undefined;
  let depth = 0;
  while (current && depth < 10) {
    if (accepted.includes(current.type)) return current;
    current = current.parentId ? byId.get(current.parentId) : undefined;
    depth += 1;
  }
  return undefined;
}

export interface ChildIssueRow {
  task: Task;
  depth: number;
}

/**
 * Collects child work items for the detail page, optionally nested
 * (e.g. Initiative -> its Features -> their Epics).
 */
export function collectChildRows(
  allTasks: Task[],
  rootId: string,
  maxDepth = 1
): ChildIssueRow[] {
  const rows: ChildIssueRow[] = [];
  const walk = (parentId: string, depth: number) => {
    if (depth > maxDepth) return;
    allTasks
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((child) => {
        rows.push({ task: child, depth });
        walk(child.id, depth + 1);
      });
  };
  walk(rootId, 1);
  return rows;
}

/** Full ancestor chain (root first, current issue last). */
export function getHierarchyTrail(allTasks: Task[], task: Task): Task[] {
  const trail: Task[] = [task];
  const visited = new Set<string>([task.id]);
  let curr = task;

  while (curr.parentId) {
    const parent = allTasks.find((t) => t.id === curr.parentId);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    trail.unshift(parent);
    curr = parent;
  }
  return trail;
}
