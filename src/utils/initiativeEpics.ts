import type { Task } from '../types';

/**
 * Initiative <-> Epic linking helpers.
 *
 * An Initiative links to Epics through the explicit `linkedEpicIds` list on
 * its record — a many-to-many relation kept independent of the
 * Initiative -> Feature -> Epic parent chain. Linking therefore:
 *   - never re-parents the Epic (its own parentId/projectId are untouched),
 *   - never copies or re-keys the Epic (ids are preserved exactly),
 *   - never crosses project boundaries (an Initiative only links Epics from
 *     its own project),
 *   - never duplicates a link (each Epic id appears at most once).
 *
 * Every helper is pure: callers persist the returned `linkedEpicIds` through
 * the store's existing `updateTask`. Invalid requests are refused with a
 * reason instead of silently mutating state.
 */

export interface EpicLinkResult {
  ok: boolean;
  /** The new linkedEpicIds array to persist (undefined when refused). */
  linkedEpicIds?: string[];
  /** User-facing refusal reason when ok is false. */
  reason?: string;
}

const asList = (ids: string[] | undefined): string[] => (ids ? [...ids] : []);

/**
 * Adds `epicId` to the Initiative's linked Epic list. Refuses when the two
 * records are missing, are the wrong work-item types, belong to different
 * projects, or the Epic is already linked.
 */
export function linkEpicToInitiative(
  initiative: Task | undefined,
  epic: Task | undefined
): EpicLinkResult {
  if (!initiative || initiative.type !== 'INITIATIVE') {
    return { ok: false, reason: 'Initiative not found.' };
  }
  if (!epic || epic.type !== 'EPIC') {
    return { ok: false, reason: 'Only Epics can be linked to an Initiative.' };
  }
  if (epic.projectId !== initiative.projectId) {
    return {
      ok: false,
      reason: 'Epics can only be linked within the Initiative\'s own project.',
    };
  }
  const current = asList(initiative.linkedEpicIds);
  if (current.includes(epic.id)) {
    return { ok: false, reason: 'That Epic is already linked to this Initiative.' };
  }
  return { ok: true, linkedEpicIds: [...current, epic.id] };
}

/** Removes `epicId` from the Initiative's linked Epic list. */
export function unlinkEpicFromInitiative(
  initiative: Task | undefined,
  epicId: string
): EpicLinkResult {
  if (!initiative || initiative.type !== 'INITIATIVE') {
    return { ok: false, reason: 'Initiative not found.' };
  }
  const current = asList(initiative.linkedEpicIds);
  if (!current.includes(epicId)) {
    return { ok: false, reason: 'That Epic is not linked to this Initiative.' };
  }
  return { ok: true, linkedEpicIds: current.filter((id) => id !== epicId) };
}

/**
 * Resolves the Initiative's linked Epic records against the task list.
 * Missing ids (deleted Epics) are skipped rather than fabricated; the stored
 * order is preserved. Only records that still exist AND are Epics count.
 */
export function resolveLinkedEpics(initiative: Task, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const resolved: Task[] = [];
  for (const id of initiative.linkedEpicIds ?? []) {
    const task = byId.get(id);
    if (task && task.type === 'EPIC') resolved.push(task);
  }
  return resolved;
}
