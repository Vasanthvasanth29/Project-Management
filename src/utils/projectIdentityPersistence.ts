import type { Project } from '../types';
import { normalizeProjectName } from './projectIdentity';

/**
 * localStorage bridge for project IDENTITY (name + key) only.
 *
 * The app store is re-seeded from mock data on every page load, so a rename /
 * rekey would otherwise silently revert on refresh while the rekeyed issue
 * links in `flowexec_issue_links_v1` survived — leaving the two out of sync.
 * Instead of persisting the whole `projects` array (which would shadow seed
 * updates and persist unrelated edits such as archive/progress), only the
 * user-authored identity of each project is stored, keyed by the IMMUTABLE
 * project id, and replayed onto the freshly seeded projects at store init.
 *
 * Unknown ids are pruned on load so an override can never leak onto a
 * different (e.g. newly seeded) project that later reuses the id.
 */

export const PROJECT_IDENTITY_STORAGE_KEY = 'flowexec_project_identity_v1';

export interface ProjectIdentityRecord {
  name: string;
  key: string;
}

type IdentityMap = Record<string, Partial<ProjectIdentityRecord>>;

const readMap = (): IdentityMap => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return {};
    const raw = storage.getItem(PROJECT_IDENTITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as IdentityMap;
  } catch {
    return {};
  }
};

const writeMap = (map: IdentityMap): void => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    if (Object.keys(map).length === 0) storage.removeItem(PROJECT_IDENTITY_STORAGE_KEY);
    else storage.setItem(PROJECT_IDENTITY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — identity lives for this session only */
  }
};

/** Current persisted identity overrides (project id -> name/key overrides). */
export const readProjectIdentityOverrides = (): IdentityMap => readMap();

/**
 * Applies persisted identity overrides onto freshly seeded projects.
 * Overrides for project ids that do not exist are pruned (written back), so
 * stale records can never be applied to an unrelated project later.
 */
export const applyProjectIdentityOverrides = (seedProjects: Project[]): Project[] => {
  const map = readMap();
  const seedIds = new Set(seedProjects.map((p) => p.id));
  let pruned = false;
  for (const id of Object.keys(map)) {
    if (!seedIds.has(id)) {
      delete map[id];
      pruned = true;
    }
  }
  if (pruned) writeMap(map);

  const overridden = seedProjects.filter((p) => map[p.id]);
  if (overridden.length === 0) return seedProjects;

  return seedProjects.map((p) => {
    const record = map[p.id];
    if (!record) return p;
    return {
      ...p,
      ...(record.name ? { name: record.name } : {}),
      ...(record.key ? { key: record.key } : {}),
    };
  });
};

/**
 * Records a project's current identity. When both name and key equal the
 * seed values again (rename undone), the override is removed so storage
 * stays clean; otherwise both current values are stored together so the
 * record is always a complete identity snapshot.
 */
export const saveProjectIdentityOverride = (
  projectId: string,
  identity: { name: string; key: string },
  seedProjects: Project[]
): void => {
  const map = readMap();
  const seed = seedProjects.find((p) => p.id === projectId);
  const name = normalizeProjectName(identity.name);
  const key = (identity.key || '').trim().toUpperCase();

  const sameAsSeed =
    !!seed &&
    normalizeProjectName(seed.name) === name &&
    (seed.key || '').trim().toUpperCase() === key;

  if (sameAsSeed) {
    if (map[projectId]) {
      delete map[projectId];
      writeMap(map);
    }
    return;
  }

  map[projectId] = { name, key };
  writeMap(map);
};

/** Drops the persisted identity for one project (e.g. after deletion). */
export const removeProjectIdentityOverride = (projectId: string): void => {
  const map = readMap();
  if (map[projectId]) {
    delete map[projectId];
    writeMap(map);
  }
};
