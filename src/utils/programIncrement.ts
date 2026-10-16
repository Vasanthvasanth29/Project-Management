import type { ProgramIncrement, Sprint } from '../types';

/** All PIs for a project, ascending by number (PI 29, PI 30, PI 31 …). */
export const sortProjectPis = (pis: ProgramIncrement[], projectId: string): ProgramIncrement[] =>
  pis.filter((p) => p.projectId === projectId).sort((a, b) => a.number - b.number);

/**
 * The PI number an iteration belongs to. Uses the stored relationship first
 * (iteration.piId → PI.id) and falls back to the PI-scoped number/name so
 * unmigrated or synthetic rows still resolve instead of crashing.
 */
export const piNumberForSprint = (sprint: Sprint, pis: ProgramIncrement[]): number | undefined => {
  const pi = pis.find((p) => p.id === sprint.piId);
  if (pi) return pi.number;
  const source = sprint.iterationNumber || sprint.name;
  const match = source.match(/\d+/);
  return match ? Number(match[0]) : undefined;
};

/**
 * Next iteration number under a PI — always scoped to that PI, never a global
 * counter: PI 30 with 30.1–30.3 → "30.4"; PI 30 with none → "30.1";
 * PI 31 with 31.1–31.2 → "31.3".
 */
export const nextIterationNumber = (pi: ProgramIncrement, sprints: Sprint[]): string => {
  const existing = sprints.filter((s) => s.piId === pi.id && !s.isArchived);
  const maxSeq = existing.reduce((max, s) => {
    const seq = Number((s.iterationNumber || '').split('.')[1]);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${pi.number}.${maxSeq + 1}`;
};

/** True when `iterationNumber` already exists under the given PI (uniqueness per PI). */
export const iterationNumberExists = (
  sprints: Sprint[],
  piId: string,
  iterationNumber: string,
  excludeSprintId?: string
): boolean =>
  sprints.some(
    (s) =>
      s.piId === piId &&
      s.id !== excludeSprintId &&
      (s.iterationNumber || '').trim() === iterationNumber.trim()
  );

export interface PiGroup {
  /** Real PI id, or a derived key for iterations whose PI record is missing. */
  key: string;
  piId: string | undefined;
  number: number | undefined;
  label: string;
  sprints: Sprint[];
}

/**
 * Group iterations under their parent PI for display (Project → PI → Iteration).
 * Preserves the caller's sprint order inside each group; group order follows
 * first appearance in the input (so callers keep their status/date ranking),
 * then PIs without iterations are appended ascending so empty PIs stay
 * reachable for "+ Add Iteration".
 */
export const groupSprintsByPi = (
  sprints: Sprint[],
  pis: ProgramIncrement[],
  projectId?: string
): PiGroup[] => {
  const groups = new Map<string, PiGroup>();
  const order: string[] = [];

  const ensureGroup = (key: string, pi: ProgramIncrement | undefined, number: number | undefined): PiGroup => {
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        piId: pi?.id,
        number,
        label: number !== undefined ? `PI ${number}` : 'Unassigned',
        sprints: [],
      };
      groups.set(key, group);
      order.push(key);
    }
    return group;
  };

  sprints.forEach((sprint) => {
    const pi = pis.find((p) => p.id === sprint.piId);
    const number = pi ? pi.number : piNumberForSprint(sprint, pis);
    const key = pi ? pi.id : `derived-${sprint.projectId}-${number ?? 'x'}`;
    ensureGroup(key, pi, number).sprints.push(sprint);
  });

  if (projectId) {
    sortProjectPis(pis, projectId).forEach((pi) => {
      if (!groups.has(pi.id)) ensureGroup(pi.id, pi, pi.number);
    });
  }

  return order.map((key) => groups.get(key)!);
};
