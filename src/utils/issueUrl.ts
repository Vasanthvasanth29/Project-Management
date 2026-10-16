import { useAppStore } from '../store/appStore';
import { resolveIssueKey } from './issueKeyResolver';
import { toUrlId } from './idUtils';
import type { Task } from '../types';

/** Detail-page routes that render the canonical issue page. */
export type IssueDetailBase = '/member/tasks' | '/tl/tasks';

/**
 * Jira-style URL for the canonical issue-detail page — `/member/tasks/ECOMM-500`.
 *
 * This is the ONE place that turns an issue into its detail URL, so every
 * listing (Iterations, Live Iteration, My Tasks, dashboards, search,
 * notifications, activity, issue links, ...) navigates with the same public
 * issue key the detail page header shows — never the internal task id.
 *
 * Accepts a Task or its internal id. When the issue cannot be resolved from
 * the store (e.g. it was deleted), the legacy id segment is kept so
 * navigation never produces a malformed path; the detail page still resolves
 * that shape.
 */
export const issuePath = (
  target: Task | string | null | undefined,
  basePath: IssueDetailBase = '/member/tasks'
): string => {
  if (!target) return basePath;

  const store = useAppStore.getState();
  const task = typeof target === 'string' ? store.tasks.find((t) => t.id === target) : target;
  if (!task) return typeof target === 'string' ? `${basePath}/${toUrlId(target)}` : basePath;

  const project = store.projects.find((p) => p.id === task.projectId);
  const key = resolveIssueKey(project, task);
  return key ? `${basePath}/${key}` : `${basePath}/${toUrlId(task.id)}`;
};
