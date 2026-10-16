import type { CustomFieldDefinition, CustomFieldValue, Task } from '../types';
import { isLegacySeedCustomFieldId } from '../data/customFields';

/**
 * localStorage bridge so Admin/PM-created custom field definitions and
 * per-issue values survive page refresh (the app store itself resets to seed
 * data on reload). Frontend-only persistence — no backend involved.
 */
const STORAGE_KEY = 'flowexec-custom-fields-v1';

export interface CustomFieldSnapshot {
  definitions?: CustomFieldDefinition[];
  taskValues?: Record<string, Record<string, CustomFieldValue>>;
}

/** Read the persisted custom-field snapshot, or null when absent/unreadable. */
export const readCustomFieldSnapshot = (): CustomFieldSnapshot | null => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as CustomFieldSnapshot;
  } catch {
    return null;
  }
};

/** Serialize the current definitions + per-issue values into a JSON string. */
export const serializeCustomFieldSnapshot = (
  definitions: CustomFieldDefinition[],
  tasks: Pick<Task, 'id' | 'customFieldValues'>[]
): string => {
  const taskValues: Record<string, Record<string, CustomFieldValue>> = {};
  tasks.forEach((task) => {
    if (task.customFieldValues && Object.keys(task.customFieldValues).length > 0) {
      taskValues[task.id] = task.customFieldValues;
    }
  });
  return JSON.stringify({ definitions, taskValues } satisfies CustomFieldSnapshot);
};

/** Write the snapshot; silently no-ops when storage is unavailable. */
const writeSnapshot = (serialized: string): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
  } catch {
    /* quota exceeded / storage unavailable — demo data stays in-memory */
  }
};

let lastSerialized: string | null = null;

/**
 * Store hook: serialize definitions + per-issue values and write to
 * localStorage, deduplicated so unchanged state never hits storage.
 */
export const persistCustomFieldSnapshot = (
  definitions: CustomFieldDefinition[],
  tasks: Pick<Task, 'id' | 'customFieldValues'>[]
): void => {
  try {
    const next = serializeCustomFieldSnapshot(definitions, tasks);
    if (next === lastSerialized) return;
    lastSerialized = next;
    writeSnapshot(next);
  } catch {
    /* serialization failure — ignore */
  }
};

/**
 * Hydrate state with a persisted snapshot: saved definitions replace the
 * (now empty) seed list — an empty array is a valid "all fields deleted"
 * state — and saved per-issue values are layered over the base tasks.
 * Snapshots written before the seed cleanup are migrated here: legacy
 * auto-seeded definitions and their injected values are dropped so no
 * pre-configured custom field ever appears on an issue again.
 */
export const applyCustomFieldSnapshot = (
  seedDefinitions: CustomFieldDefinition[],
  seedTasks: Task[],
  snapshot: CustomFieldSnapshot | null
): { definitions: CustomFieldDefinition[]; tasks: Task[] } => {
  if (!snapshot) return { definitions: seedDefinitions, tasks: seedTasks };

  const definitions = Array.isArray(snapshot.definitions)
    ? snapshot.definitions.filter((d) => !isLegacySeedCustomFieldId(d.id))
    : seedDefinitions;

  const taskValues = snapshot.taskValues ?? {};
  const cleanedTaskValues: Record<string, Record<string, CustomFieldValue>> = {};
  Object.entries(taskValues).forEach(([taskId, values]) => {
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([fieldId]) => !isLegacySeedCustomFieldId(fieldId))
    );
    if (Object.keys(cleaned).length > 0) cleanedTaskValues[taskId] = cleaned;
  });

  const hasValues = Object.keys(cleanedTaskValues).length > 0;
  const tasks = hasValues
    ? seedTasks.map((task) =>
        cleanedTaskValues[task.id]
          ? {
              ...task,
              customFieldValues: { ...(task.customFieldValues ?? {}), ...cleanedTaskValues[task.id] },
            }
          : task
      )
    : seedTasks;

  return { definitions, tasks };
};
