import type { DependencyType, Project, Task, TaskDependency } from '../types';
import { useAppStore } from '../store/appStore';
import { resolveIssueKey, resolveTaskByIssueKey } from './issueKeyResolver';
import { getIssueKeyPrefix, rekeyIssueKey } from './projectIdentity';

/**
 * localStorage-backed persistence for issue links.
 *
 * The app store is seeded fresh on every page load and board issues are
 * materialised into Tasks with session-specific ids, so dependency records
 * alone cannot survive a refresh. Links created from the Link dialog are
 * therefore ALSO stored by their stable public issue key + title and are
 * re-bound to whatever Tasks exist (or are materialised on demand) after a
 * reload — no internal task ids are relied on across sessions.
 */
const STORAGE_KEY = 'flowexec_issue_links_v1';

export interface PersistedIssueLink {
  id: string;
  fromKey: string;
  fromTitle: string;
  fromProjectId: string;
  toKey: string;
  toTitle: string;
  toProjectId: string;
  type: DependencyType;
  comment?: string;
  createdAt: string;
}

export const readPersistedIssueLinks = (): PersistedIssueLink[] => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedIssueLink[]) : [];
  } catch {
    return [];
  }
};

const writePersistedIssueLinks = (records: PersistedIssueLink[]): void => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable — links still work for the current session */
  }
};

/** Store a dependency by its stable public key/title so it survives a reload. */
export const persistTaskDependency = (dep: TaskDependency): void => {
  const store = useAppStore.getState();
  const from = store.tasks.find((t) => t.id === dep.taskId);
  const to = store.tasks.find((t) => t.id === dep.dependsOnTaskId);
  if (!from || !to) return;

  const fromProject = store.projects.find((p) => p.id === from.projectId);
  const toProject = store.projects.find((p) => p.id === to.projectId);

  const record: PersistedIssueLink = {
    id: dep.id,
    fromKey: resolveIssueKey(fromProject, from),
    fromTitle: from.title,
    fromProjectId: from.projectId,
    toKey: resolveIssueKey(toProject, to),
    toTitle: to.title,
    toProjectId: to.projectId,
    type: dep.type,
    comment: dep.comment,
    createdAt: dep.createdAt,
  };

  writePersistedIssueLinks([...readPersistedIssueLinks().filter((r) => r.id !== dep.id), record]);
};

export const unpersistTaskDependency = (dependencyId: string): void => {
  writePersistedIssueLinks(readPersistedIssueLinks().filter((r) => r.id !== dependencyId));
};

/**
 * Re-issues persisted link keys after a project rekey: both ends that belong
 * to `projectId` and still carry the OLD issue prefix are rewritten under the
 * new prefix (numbers and titles untouched), so stored links stay resolvable.
 */
export const rekeyPersistedIssueLinks = (
  projectId: string,
  oldPrefix: string,
  newPrefix: string
): void => {
  const oldP = oldPrefix.trim().toUpperCase();
  const newP = newPrefix.trim().toUpperCase();
  if (!oldP || !newP || oldP === newP) return;

  const records = readPersistedIssueLinks();
  let changed = false;
  const rekey = (key: string, endProjectId: string): string => {
    if (endProjectId !== projectId) return key;
    const dash = key.lastIndexOf('-');
    if (dash <= 0 || key.slice(0, dash).toUpperCase() !== oldP) return key;
    changed = true;
    return `${newP}${key.slice(dash)}`;
  };

  const next = records.map((r) => {
    const fromKey = rekey(r.fromKey, r.fromProjectId);
    const toKey = rekey(r.toKey, r.toProjectId);
    return fromKey === r.fromKey && toKey === r.toKey ? r : { ...r, fromKey, toKey };
  });
  if (changed) writePersistedIssueLinks(next);
};

/**
 * Re-issues a stored link key under its owning project's CURRENT prefix so a
 * refresh (or a legacy record written under a different prefix) still
 * resolves: `SHOP-500` under a project that is back on `ECOMM` becomes
 * `ECOMM-500` (and vice versa). The numeric suffix is never touched, and
 * keys whose project no longer exists are returned unchanged.
 */
const normalizeLinkKey = (key: string, projectId: string): string => {
  const store = useAppStore.getState();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return key;
  const prefix = getIssueKeyPrefix(project);
  return prefix ? rekeyIssueKey(prefix, key) : key;
};

/**
 * One-time startup reconciliation: rewrites every persisted link end to the
 * owning project's current issue prefix. Heals records left behind by a
 * rekey whose identity did not persist (or a refresh that reverted the
 * store) so links never go permanently stale. Only the two key fields are
 * rewritten — ids, titles, project ids, type and timestamps are untouched,
 * and records are updated in place (no duplicates).
 */
export const reconcilePersistedIssueLinks = (projects: Project[]): void => {
  const records = readPersistedIssueLinks();
  if (records.length === 0) return;
  const byId = new Map(projects.map((p) => [p.id, p]));
  let changed = false;

  const next = records.map((r) => {
    const normalizeEnd = (key: string, projectId: string): string => {
      const project = byId.get(projectId);
      if (!project) return key;
      const prefix = getIssueKeyPrefix(project);
      if (!prefix) return key;
      const normalized = rekeyIssueKey(prefix, key);
      if (normalized !== key) changed = true;
      return normalized;
    };
    const fromKey = normalizeEnd(r.fromKey, r.fromProjectId);
    const toKey = normalizeEnd(r.toKey, r.toProjectId);
    return fromKey === r.fromKey && toKey === r.toKey ? r : { ...r, fromKey, toKey };
  });

  if (changed) writePersistedIssueLinks(next);
};

/**
 * Resolve one end of a persisted link to a real Task: first by exact title
 * within the project (how board issues are materialised), otherwise by the
 * stored issue key — `resolveTaskByIssueKey` materialises seed issues on
 * demand, so the other side of a link can be recreated after a refresh too.
 * Returns undefined when the issue no longer exists (link stays pending).
 */
const findPersistedLinkEnd = (
  key: string,
  projectId: string,
  title: string
): Task | undefined => {
  const store = useAppStore.getState();
  const wantedTitle = title.trim().toLowerCase();

  const byTitle = store.tasks.find(
    (t) => t.projectId === projectId && t.title.trim().toLowerCase() === wantedTitle
  );
  if (byTitle) return byTitle;

  const byKey = resolveTaskByIssueKey(normalizeLinkKey(key, projectId))?.task;
  if (
    byKey &&
    byKey.projectId === projectId &&
    byKey.title.trim().toLowerCase() === wantedTitle
  ) {
    return byKey;
  }
  return undefined;
};

/** Resolve both ends of a persisted link; undefined when either is missing. */
export const resolvePersistedIssueLink = (
  record: PersistedIssueLink
): { from: Task; to: Task } | undefined => {
  const from = findPersistedLinkEnd(record.fromKey, record.fromProjectId, record.fromTitle);
  const to = findPersistedLinkEnd(record.toKey, record.toProjectId, record.toTitle);
  return from && to ? { from, to } : undefined;
};
