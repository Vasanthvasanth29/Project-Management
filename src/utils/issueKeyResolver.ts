import type { AuthUser, IssueResolution, Project, Task, TaskStatus } from '../types';
import { useAppStore } from '../store/appStore';
import { getIssueKey } from './workItemHierarchy';
import { getIssueKeyPrefix, rekeyIssueKey } from './projectIdentity';
import {
  sortProjectSprints,
  buildProjectTeamMembers,
  buildSprintIssuesMap,
  resolveIssueTaskId,
} from './sprintIssues';
import type { IterationIssue } from './sprintIssues';

export interface ResolvedIssue {
  task: Task;
  project: Project;
}

// ResolveIssueKey cache: keyed on the store's `tasks` array identity, so it is
// invalidated automatically whenever tasks change (materialisation, edits, ...).
const issueKeyCache = new WeakMap<Task[], Map<string, string>>();

/**
 * Deterministic Jira-style display key for a Task — the ONE resolver used for
 * keys shown on the Issue Details page (header is the URL key; this covers
 * Parent Link / Epic Link / Issue Links / child lists / search).
 *
 *  1. The task's OWN public key (`task.issueKey`) always wins: it is the key
 *     the issue was opened with (board/iteration key) or created with, so the
 *     displayed key can never drift to a same-titled issue in another sprint.
 *  2. Otherwise (seed tasks with no explicit key) the iteration row for that
 *     exact task — matched by id, then by title within the project — supplies
 *     the board key (e.g. "ECOMM-1100").
 *  3. Finally `getIssueKey`'s seeded numeric suffix.
 *
 * Never returns a key that belongs to a different issue: all branches are
 * derived from this exact task.
 */
export const resolveIssueKey = (
  project: Project | undefined | null,
  task: Task
): string => {
  if (!project) return getIssueKey(undefined, task);

  const store = useAppStore.getState();
  // The cache key includes the project key so a rename/rekey (same project id,
  // new prefix) can never serve a stale key from a previous render.
  const cacheKey = `${project.id}|${project.key || ''}|${task.id}`;

  let perTasks = issueKeyCache.get(store.tasks);
  if (!perTasks) {
    perTasks = new Map();
    issueKeyCache.set(store.tasks, perTasks);
  }
  const cached = perTasks.get(cacheKey);
  if (cached) return cached;

  // Branch 1: the issue's own key is its identity — re-issued under the
  // project's CURRENT prefix (a rekey updates the number, never the issue).
  if (task.issueKey) {
    const ownKey = rekeyIssueKey(getIssueKeyPrefix(project), task.issueKey);
    perTasks.set(cacheKey, ownKey);
    return ownKey;
  }

  const projectSprints = sortProjectSprints(store.sprints, project.id);
  let key = getIssueKey(project, task);

  if (projectSprints.length > 0) {
    const issuesBySprint = buildSprintIssuesMap({
      tasks: store.tasks,
      users: store.users,
      project,
      projectId: project.id,
      projectKey: getIssueKeyPrefix(project) || 'PRJ',
      projectTeamMembers: buildProjectTeamMembers(project, store.teams, store.users),
      projectSprints,
    });

    const wantedTitle = task.title.trim().toLowerCase();
    for (const sprint of projectSprints) {
      const rows = issuesBySprint[sprint.id] || [];
      // Exact row for this task first (materialised issues share their Task id);
      // a same-titled row only counts when it is not another task's row.
      const hit =
        rows.find((i) => i.id === task.id) ||
        rows.find((i) => i.title.trim().toLowerCase() === wantedTitle && !i.id.startsWith('gen-')) ||
        rows.find((i) => i.id.startsWith('gen-') && i.title.trim().toLowerCase() === wantedTitle);
      if (hit) {
        key = rekeyIssueKey(getIssueKeyPrefix(project), hit.key);
        break;
      }
    }
  }

  perTasks.set(cacheKey, key);
  return key;
};

/**
 * Resolve a Jira-style issue key (e.g. "ECOMM-501") to its real Task record,
 * for the /browse/{issueKey} route. Two key schemes exist in the app and both
 * are supported here:
 *
 *  1. Iteration seed-issue keys shown on the Live Iteration board (sprint-index
 *     based, e.g. the ones in `sprintIssues.ts`). Materialised into a real
 *     Task on demand via the same find-or-create resolver the board itself
 *     already uses — repeat visits (including a page refresh) re-resolve to
 *     the SAME task because that resolver matches by title before creating.
 *  2. The issue's own key via `getIssueKey` — the key assigned when the issue
 *     was created (`task.issueKey`, e.g. the board key stored on a materialised
 *     issue) or the seeded numeric suffix (`ECOMM-001`), used by Issue Links
 *     and Parent Task navigation for items that are not on a board. Round-trips
 *     with `resolveIssueKey`, so every surface shows the same key.
 */
export const resolveTaskByIssueKey = (
  issueKey: string,
  currentUser?: AuthUser | null
): ResolvedIssue | undefined => {
  const trimmedKey = issueKey.trim().toUpperCase();
  const lastDash = trimmedKey.lastIndexOf('-');
  if (lastDash <= 0) return undefined;
  const prefix = trimmedKey.slice(0, lastDash);

  const store = useAppStore.getState();
  const { projects, users, teams, sprints } = store;

  // A key's prefix maps to a project through the DERIVED issue prefix (and the
  // raw key itself, which can differ only by a version suffix like "WEBCORM4.0").
  const candidateProjects = projects.filter(
    (p) =>
      getIssueKeyPrefix(p) === prefix || (p.key || '').trim().toUpperCase() === prefix
  );

  for (const project of candidateProjects) {
    // Scheme 1: sprint seed-issue key (Live Iteration board / Iterations Overview).
    const projectSprints = sortProjectSprints(sprints, project.id);
    const projectTeamMembers = buildProjectTeamMembers(project, teams, users);
    const issuesBySprint = buildSprintIssuesMap({
      tasks: store.tasks,
      users,
      project,
      projectId: project.id,
      projectKey: prefix,
      projectTeamMembers,
      projectSprints,
    });

    for (const sprint of projectSprints) {
      const issue = (issuesBySprint[sprint.id] || []).find((i) => i.key.toUpperCase() === trimmedKey);
      if (!issue) continue;
      const taskId = resolveIssueTaskId({
        issue,
        projectId: project.id,
        sprintId: sprint.id,
        users,
        currentUser,
      });
      const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
      if (task) return { task, project };
    }

    // Scheme 2: the issue's own key (assigned at creation / seeded suffix).
    const directMatches = store.tasks.filter(
      (t) => t.projectId === project.id && getIssueKey(project, t).toUpperCase() === trimmedKey
    );
    if (directMatches.length > 0) {
      // Several issues can derive the same id-suffix key (e.g. task-003 and
      // subtask-003 both → ECOMM-003). Prefer the one whose OWN displayed key
      // (resolveIssueKey) is this key, so /browse/{key} opens the issue that
      // actually shows that key in the UI — falling back to array order.
      const exact =
        directMatches.find((t) => resolveIssueKey(project, t).toUpperCase() === trimmedKey) ||
        directMatches[0];
      return { task: exact, project };
    }
  }

  return undefined;
};

export interface IssueSearchHit {
  key: string;
  title: string;
  projectId: string;
  type: Task['type'] | IterationIssue['type'];
  status: TaskStatus;
  /** Terminal resolution (CANCELLED issues show as Cancelled in pickers). */
  resolution?: IssueResolution;
  /** Present when the issue already exists as a Task; board issues are materialised on selection. */
  task?: Task;
}

/**
 * Search issues by their real Jira-style key or title across EVERY project —
 * existing Tasks plus board/seed issues that have not been materialised yet
 * (those still carry their real key, title and status; nothing is generated).
 * Shared by the Link dialog's picker and its "or search for an issue" action.
 */
export const searchIssues = (needle: string): IssueSearchHit[] => {
  const store = useAppStore.getState();
  const q = needle.trim().toLowerCase();
  const hits: IssueSearchHit[] = [];
  const seen = new Set<string>();

  store.tasks.forEach((t) => {
    const project = store.projects.find((p) => p.id === t.projectId);
    const key = resolveIssueKey(project, t);
    if (q && !key.toLowerCase().includes(q) && !t.title.toLowerCase().includes(q)) return;
    seen.add(`${t.projectId}|${t.title.trim().toLowerCase()}`);
    hits.push({
      key,
      title: t.title,
      projectId: t.projectId,
      type: t.type,
      status: t.status,
      resolution: t.status === 'DONE' ? t.resolution : undefined,
      task: t,
    });
  });

  store.projects.forEach((project) => {
    const projectSprints = sortProjectSprints(store.sprints, project.id);
    if (projectSprints.length === 0) return;

    const issuesBySprint = buildSprintIssuesMap({
      tasks: store.tasks,
      users: store.users,
      project,
      projectId: project.id,
      projectKey: getIssueKeyPrefix(project) || 'PRJ',
      projectTeamMembers: buildProjectTeamMembers(project, store.teams, store.users),
      projectSprints,
    });

    projectSprints.forEach((sprint) => {
      (issuesBySprint[sprint.id] || []).forEach((issue) => {
        const identity = `${project.id}|${issue.title.trim().toLowerCase()}`;
        if (seen.has(identity)) return;
        if (q && !issue.key.toLowerCase().includes(q) && !issue.title.toLowerCase().includes(q)) return;
        seen.add(identity);
        hits.push({
          key: rekeyIssueKey(getIssueKeyPrefix(project), issue.key),
          title: issue.title,
          projectId: project.id,
          type: issue.type,
          status: issue.status,
          resolution: issue.resolution,
        });
      });
    });
  });

  return hits;
};
