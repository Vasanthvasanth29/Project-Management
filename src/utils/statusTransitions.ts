import type { StatusTransition, TaskStatus, TransitionStatus } from '../types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Exact date and time of a transition in the reference format, e.g. `17/Aug/26 07:13`.
 * Rendered from the record's own `changedAt` - never a hardcoded string.
 */
export const formatTransitionDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).slice(-2);
  return `${pad2(date.getDate())}/${MONTHS_SHORT[date.getMonth()]}/${year} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/**
 * Human readable duration with no unnecessary zero components:
 *
 *   seconds -> `5s`
 *   minutes -> `12m`  (`1m 30s` when there are whole seconds left)
 *   hours   -> `4h 30m`
 *   days    -> `2d 4h` / `66d 21h 1m`
 */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) return seconds ? `${totalMinutes}m ${seconds}s` : `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) return minutes ? `${totalHours}h ${minutes}m` : `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return [`${days}d`, hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null]
    .filter(Boolean)
    .join(' ');
};

export interface TransitionActor {
  id: string;
  name?: string;
  avatarUrl?: string;
  avatarColor?: string;
}

/**
 * Build one transition-history record from a real status change: the actor, the
 * exact timestamp and how long the issue stayed in the source status are all
 * derived from the change itself - nothing displayed is hardcoded.
 */
export const buildStatusTransition = (params: {
  fromStatus: TransitionStatus;
  toStatus: TransitionStatus;
  /** When the issue entered `fromStatus` (its previous transition, else its creation). */
  sourceEnteredAt: string;
  changedAt?: string;
  actor?: TransitionActor | null;
}): StatusTransition => {
  const { fromStatus, toStatus, sourceEnteredAt, changedAt = new Date().toISOString(), actor } = params;
  const sourceMs = new Date(sourceEnteredAt).getTime();
  const changedMs = new Date(changedAt).getTime();

  return {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: actor?.id || 'system',
    userName: actor?.name?.trim() || 'System',
    userAvatar: actor?.avatarUrl,
    userAvatarColor: actor?.avatarColor,
    fromStatus,
    toStatus,
    changedAt,
    sourceEnteredAt,
    timeInSourceStatus:
      Number.isNaN(sourceMs) || Number.isNaN(changedMs) || changedMs < sourceMs
        ? '0s'
        : formatDuration(changedMs - sourceMs),
  };
};

/** The workflow path an issue of this terminal/current status plausibly took. */
const STATUS_PATH: Record<TaskStatus, TransitionStatus[]> = {
  TODO: ['TODO'],
  IN_PROGRESS: ['IN_PROGRESS'],
  IN_REVIEW: ['IN_PROGRESS', 'IN_REVIEW'],
  TESTING: ['IN_PROGRESS', 'TESTING'],
  BUG_FIX: ['IN_PROGRESS', 'BUG_FIX'],
  RETEST: ['IN_PROGRESS', 'RETEST'],
  BLOCKED: ['IN_PROGRESS', 'BLOCKED'],
  DONE: ['IN_PROGRESS', 'DONE'],
  CANCELLED: ['IN_PROGRESS', 'CANCELLED'],
  BACKLOG: ['BACKLOG'],
  ASSESSMENT: ['ASSESSMENT'],
  ON_BOARD: ['ON_BOARD'],
  READY_FOR_DEVELOPMENT: ['READY_FOR_DEVELOPMENT'],
  IN_DEVELOPMENT: ['IN_DEVELOPMENT'],
  ON_HOLD: ['ON_HOLD'],
  DEVELOPMENT_COMPLETE: ['DEVELOPMENT_COMPLETE'],
  READY_FOR_DEPLOYMENT: ['READY_FOR_DEPLOYMENT'],
  DEPLOYMENT: ['DEPLOYMENT'],
  VALIDATION: ['VALIDATION'],
  COMPLETED: ['COMPLETED'],
};

interface SynthesisUser {
  id: string;
  name?: string;
  avatarUrl?: string;
  avatarColor?: string;
}

/**
 * Seed-data helper: a realistic transition history for a work item that only
 * carries its creation/status/dates (seed tasks and board issues materialised
 * into Tasks). The chain is derived entirely from the record itself —
 * `IN TEAM BACKLOG → TODO → … → <current status>` — with each record's
 * `sourceEnteredAt`, actor and timestamp produced by the same
 * `buildStatusTransition` used for real runtime changes, so the Transitions
 * table renders them exactly like live history. Returns `[]` for a brand-new
 * TODO-less item rather than fabricating anything unsensible.
 */
export const synthesizeTransitionHistory = (params: {
  createdAt: string;
  status: TaskStatus;
  completedAt?: string;
  updatedAt?: string;
  createdById?: string;
  assigneeId?: string;
  users?: SynthesisUser[];
}): StatusTransition[] => {
  const { createdAt, status, completedAt, updatedAt, createdById, assigneeId, users = [] } = params;

  const startMs = new Date(createdAt).getTime();
  if (Number.isNaN(startMs)) return [];
  const endRaw = new Date(completedAt || updatedAt || createdAt).getTime();
  const endMs = Number.isNaN(endRaw) || endRaw < startMs ? startMs : endRaw;

  const path: TransitionStatus[] = STATUS_PATH[status] || ['TODO'];
  const findActor = (id?: string): TransitionActor | null => {
    const u = id ? users.find((x) => x.id === id) : undefined;
    return u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor } : null;
  };
  const creator = findActor(createdById) || findActor(users[0]?.id);
  const assignee = findActor(assigneeId);

  // Full step list: entered the team backlog, moved to TODO, then the path to
  // the current status. Later steps are carried by the assignee when present.
  const steps: { to: TransitionStatus; actor: TransitionActor | null }[] = [
    { to: 'TODO' as TransitionStatus, actor: creator },
    ...path.map((to, i) => ({
      to,
      actor: i === path.length - 1 && assignee ? assignee : i % 2 === 0 ? creator || assignee : assignee || creator,
    })),
  ].filter((s, i, arr) => i === 0 || arr[i - 1].to !== s.to);

  const records: StatusTransition[] = [];
  const HOUR = 60 * 60 * 1000;
  let sourceEnteredAt = createdAt;

  steps.forEach((step, i) => {
    // First step settles an hour after entry; later steps spread evenly to the
    // issue's completion/update moment (at least an hour apart).
    const t =
      i === 0
        ? startMs + HOUR
        : steps.length === 1
        ? startMs + HOUR
        : startMs + Math.max(HOUR, Math.round(((endMs - startMs) * i) / (steps.length - 1)));
    const changedAt = new Date(Math.max(t, startMs + HOUR * i)).toISOString();
    const from: TransitionStatus = i === 0 ? 'IN TEAM BACKLOG' : steps[i - 1].to;
    records.push(
      buildStatusTransition({
        fromStatus: from,
        toStatus: step.to,
        sourceEnteredAt,
        changedAt,
        actor: step.actor,
      })
    );
    sourceEnteredAt = changedAt;
  });

  return records;
};
