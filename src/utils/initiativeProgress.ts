import type { Task } from '../types';
import { isOverdue } from './dateUtils';
import { isCancelledWorkItem } from './roleUtils';
import { resolveLinkedEpics } from './initiativeEpics';

/**
 * Initiative progress and schedule health.
 *
 * Progress is measured ONLY from the Initiative's linked Epics and their
 * descendants — never from unrelated project or sprint counts. The
 * calculation:
 *
 *   total     = linked Epics (that still exist in the store)
 *               + every work item reachable from them via parentId
 *                 (stories, tasks, bugs, sub-tasks … within the same project)
 *   completed = items in that set with a terminal-done status
 *               (DONE or COMPLETED, excluding cancelled work)
 *   percent   = round(completed / total * 100), or null when total is 0
 *
 * An Initiative with no linked Epics (or whose linked Epics have no work
 * under them yet) reports percent = null / hasLinkedWork = false — the UI
 * must show "not tracked" rather than inventing 0 %.
 */
export interface InitiativeProgress {
  /** Work items measured (linked Epics + descendants). */
  total: number;
  /** Items counted as completed within that set. */
  completed: number;
  /** Completion percentage, or null when there is no linked work to measure. */
  percent: number | null;
  /** False when nothing measurable is linked yet. */
  hasLinkedWork: boolean;
}

const isCompletedWorkItem = (task: Task): boolean =>
  !isCancelledWorkItem(task) && (task.status === 'DONE' || task.status === 'COMPLETED');

/**
 * Collects a linked Epic plus every descendant reachable through parentId
 * links inside the same project. Cycles (corrupt data) terminate safely.
 */
function collectEpicSubtree(epic: Task, tasks: Task[]): Task[] {
  const childrenByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.projectId !== epic.projectId || !t.parentId) continue;
    const bucket = childrenByParent.get(t.parentId);
    if (bucket) bucket.push(t);
    else childrenByParent.set(t.parentId, [t]);
  }
  const collected: Task[] = [epic];
  const seen = new Set<string>([epic.id]);
  const queue: string[] = [epic.id];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      collected.push(child);
      queue.push(child.id);
    }
  }
  return collected;
}

/** Computes an Initiative's progress from its linked Epics (see module doc). */
export function calculateInitiativeProgress(
  initiative: Task,
  tasks: Task[]
): InitiativeProgress {
  const linkedEpics = resolveLinkedEpics(initiative, tasks);
  if (linkedEpics.length === 0) {
    return { total: 0, completed: 0, percent: null, hasLinkedWork: false };
  }
  const measured = new Map<string, Task>();
  for (const epic of linkedEpics) {
    for (const item of collectEpicSubtree(epic, tasks)) {
      measured.set(item.id, item);
    }
  }
  const items = [...measured.values()];
  const completed = items.filter(isCompletedWorkItem).length;
  const total = items.length;
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : null,
    hasLinkedWork: total > 0,
  };
}

/**
 * True when the Initiative has a target (due) date that has passed and it is
 * not yet Completed — the same overdue convention the boards and date utils
 * use for work items.
 */
export const isInitiativeOverdue = (initiative: Task): boolean =>
  initiative.status !== 'COMPLETED' && isOverdue(initiative.dueDate);
