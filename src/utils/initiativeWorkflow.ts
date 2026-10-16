import type { InitiativeWorkflowStatus, TaskStatus } from '../types';
import { getStatusLabel } from './roleUtils';

/**
 * Centralised Initiative workflow rules — the single source of truth for what
 * status transitions an INITIATIVE work item may make (Jira Advanced Roadmaps
 * style). Every surface (detail page, store gates, automations) computes
 * transitions through this module; the rules are never duplicated elsewhere.
 *
 * Linear chain (one step at a time, in either direction):
 *
 *   BACKLOG → ASSESSMENT → ON_BOARD → READY_FOR_DEVELOPMENT → IN_DEVELOPMENT →
 *   DEVELOPMENT_COMPLETE → READY_FOR_DEPLOYMENT → DEPLOYMENT → VALIDATION → COMPLETED
 *
 * Side state:
 *   - ON_HOLD may only be entered from the intermediate states (Assessment …
 *     Validation) — never from Backlog and never from Completed.
 *   - While On Hold, the chain status the Initiative came from is stored on the
 *     record as `initiativePreviousStatus`; the ONLY exit from On Hold is back
 *     to that stored status.
 *   - COMPLETED is terminal.
 *
 * Legacy statuses (TODO / IN_PROGRESS / DONE) that predate the Initiative
 * workflow are evaluated from their mapped chain position, so old records keep
 * working without inventing transitions that skip steps.
 */

/** The ordered Initiative chain — the only legal progression. */
export const INITIATIVE_WORKFLOW_CHAIN: readonly InitiativeWorkflowStatus[] = [
  'BACKLOG',
  'ASSESSMENT',
  'ON_BOARD',
  'READY_FOR_DEVELOPMENT',
  'IN_DEVELOPMENT',
  'DEVELOPMENT_COMPLETE',
  'READY_FOR_DEPLOYMENT',
  'DEPLOYMENT',
  'VALIDATION',
  'COMPLETED',
];

/** Chain states an Initiative may be put On Hold from (Assessment … Validation). */
const ON_HOLD_ALLOWED_FROM: readonly InitiativeWorkflowStatus[] = [
  'ASSESSMENT',
  'ON_BOARD',
  'READY_FOR_DEVELOPMENT',
  'IN_DEVELOPMENT',
  'DEVELOPMENT_COMPLETE',
  'READY_FOR_DEPLOYMENT',
  'DEPLOYMENT',
  'VALIDATION',
];

/** Pre-workflow statuses mapped onto their chain position for evaluation only. */
const LEGACY_CHAIN_MAP: Partial<Record<TaskStatus, InitiativeWorkflowStatus>> = {
  TODO: 'BACKLOG',
  IN_PROGRESS: 'IN_DEVELOPMENT',
  DONE: 'COMPLETED',
};

const isChainStatus = (status: TaskStatus | string): status is InitiativeWorkflowStatus =>
  (INITIATIVE_WORKFLOW_CHAIN as readonly string[]).includes(status);

/**
 * Chain index of any status: real chain statuses use their own position, legacy
 * statuses their mapped position, unknown statuses fall back to the workflow
 * entry point (Backlog) so evaluation never throws.
 */
const chainIndex = (status: TaskStatus): number => {
  if (isChainStatus(status)) return INITIATIVE_WORKFLOW_CHAIN.indexOf(status);
  const mapped = LEGACY_CHAIN_MAP[status];
  if (mapped) return INITIATIVE_WORKFLOW_CHAIN.indexOf(mapped);
  return 0;
};

/** The canonical chain status a non-chain status evaluates from. */
const asChainStatus = (status: TaskStatus): InitiativeWorkflowStatus =>
  INITIATIVE_WORKFLOW_CHAIN[chainIndex(status)];

/**
 * The board column an Initiative belongs in. On Hold is its own side column;
 * everything else (chain statuses and legacy statuses alike) maps onto the
 * chain position it evaluates from, so old records land in a sane column.
 */
export const initiativeBoardColumn = (status: TaskStatus): InitiativeWorkflowStatus =>
  status === 'ON_HOLD' ? 'ON_HOLD' : asChainStatus(status);

/**
 * True when `to` is a legal single-step move for an Initiative at `from`.
 * `previousStatus` is the stored resume target while the Initiative is On Hold.
 */
export function canTransitionInitiative(
  from: TaskStatus,
  to: TaskStatus,
  previousStatus?: TaskStatus
): boolean {
  if (from === to) return false;
  // Completed is terminal — nothing leaves it.
  if (from === 'COMPLETED') return false;
  // On Hold exits only to the status recorded when it was entered.
  if (from === 'ON_HOLD') {
    return previousStatus !== undefined && to === previousStatus && isChainStatus(to);
  }
  if (to === 'ON_HOLD') {
    const idx = chainIndex(from);
    return idx > 0 && idx < INITIATIVE_WORKFLOW_CHAIN.length - 1 &&
      ON_HOLD_ALLOWED_FROM.includes(INITIATIVE_WORKFLOW_CHAIN[idx]);
  }
  // Every other move must be exactly one chain step forward or backward, and
  // the target must be a real chain status (legacy labels are never valid
  // targets).
  if (!isChainStatus(to)) return false;
  const fromIdx = chainIndex(from);
  const toIdx = INITIATIVE_WORKFLOW_CHAIN.indexOf(to);
  return Math.abs(toIdx - fromIdx) === 1;
}

/**
 * The exact transitions the UI may offer for an Initiative — computed from the
 * rules above, never hardcoded in a menu:
 *   - chain states: one step forward, one step back, plus On Hold where allowed
 *   - On Hold: only the stored resume status
 *   - Completed: nothing
 */
export function getAllowedInitiativeTransitions(
  status: TaskStatus,
  previousStatus?: TaskStatus
): InitiativeWorkflowStatus[] {
  if (status === 'COMPLETED') return [];
  if (status === 'ON_HOLD') {
    return previousStatus !== undefined && isChainStatus(previousStatus)
      ? [previousStatus]
      : [];
  }

  const idx = chainIndex(status);
  const allowed: InitiativeWorkflowStatus[] = [];
  const forward = INITIATIVE_WORKFLOW_CHAIN[idx + 1];
  const backward = idx > 0 ? INITIATIVE_WORKFLOW_CHAIN[idx - 1] : undefined;
  if (forward) allowed.push(forward);
  if (backward) allowed.push(backward);
  if (ON_HOLD_ALLOWED_FROM.includes(INITIATIVE_WORKFLOW_CHAIN[idx])) allowed.push('ON_HOLD');
  return allowed;
}

export interface InitiativeStatusChange {
  /** False when the requested status change must be refused. */
  allowed: boolean;
  /**
   * Value to store on the record's `initiativePreviousStatus` when the change
   * is allowed: the resume target when entering On Hold, cleared (undefined)
   * on every other move, including resuming from On Hold.
   */
  initiativePreviousStatus?: InitiativeWorkflowStatus;
}

/**
 * Evaluates a status change on an Initiative for the store gates: validates it
 * against the workflow rules and derives the `initiativePreviousStatus` value
 * that must be persisted with it (set on hold entry, cleared otherwise).
 */
export function evaluateInitiativeStatusChange(
  current: { status: TaskStatus; initiativePreviousStatus?: InitiativeWorkflowStatus },
  to: TaskStatus
): InitiativeStatusChange {
  if (!canTransitionInitiative(current.status, to, current.initiativePreviousStatus)) {
    return { allowed: false };
  }
  if (to === 'ON_HOLD') {
    return { allowed: true, initiativePreviousStatus: asChainStatus(current.status) };
  }
  // Chain moves and resuming from On Hold both clear the stored resume target.
  return { allowed: true };
}

/**
 * The user-facing reason a move was refused — the single message every board,
 * bulk action and form surfaces when the store rejects an Initiative transition.
 */
export function explainInitiativeTransition(
  from: TaskStatus,
  to: TaskStatus,
  previousStatus?: TaskStatus
): string {
  if (from === 'COMPLETED') {
    return 'Completed is final — an Initiative cannot leave Completed.';
  }
  if (from === 'ON_HOLD') {
    return previousStatus !== undefined
      ? `The Initiative is On Hold — the only move is back to ${getStatusLabel(previousStatus)}.`
      : 'The Initiative is On Hold and has no stage recorded to resume to.';
  }
  if (to === 'ON_HOLD') {
    return `An Initiative cannot go On Hold from ${getStatusLabel(from)}.`;
  }
  const allowed = getAllowedInitiativeTransitions(from, previousStatus);
  if (allowed.length === 0) {
    return `No moves are available from ${getStatusLabel(from)}.`;
  }
  return `Initiatives move one step at a time — from ${getStatusLabel(from)} you can move to ${allowed
    .map(getStatusLabel)
    .join(' or ')}.`;
}

// ============================================================
// Simplified Initiative Board model (5 board columns)
// ============================================================

/**
 * The Initiative Board presents the granular chain above as five board
 * columns. Column membership is a pure view over the chain — the chain (and
 * the store gate built on it) stays the single source of truth for what is
 * legal, so the board can never invent a transition the workflow forbids:
 *
 *   BACKLOG     <- BACKLOG, ASSESSMENT            (plus legacy TODO)
 *   PLANNED     <- ON_BOARD, READY_FOR_DEVELOPMENT
 *   IN_PROGRESS <- IN_DEVELOPMENT ... VALIDATION   (plus legacy IN_PROGRESS)
 *   ON_HOLD     <- ON_HOLD
 *   COMPLETED   <- COMPLETED                       (plus legacy DONE)
 *
 * A card moves between columns only when a legal one-step chain move lands in
 * the target column; COMPLETED stays terminal and ON_HOLD resumes to the
 * chain status recorded on the record.
 */
export type InitiativeBoardStatus = 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

export const INITIATIVE_BOARD_STATUSES: readonly InitiativeBoardStatus[] = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
];

export const INITIATIVE_BOARD_STATUS_LABEL: Record<InitiativeBoardStatus, string> = {
  BACKLOG: 'Backlog',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
};

const CHAIN_TO_BOARD: Record<InitiativeWorkflowStatus, InitiativeBoardStatus> = {
  BACKLOG: 'BACKLOG',
  ASSESSMENT: 'BACKLOG',
  ON_BOARD: 'PLANNED',
  READY_FOR_DEVELOPMENT: 'PLANNED',
  IN_DEVELOPMENT: 'IN_PROGRESS',
  DEVELOPMENT_COMPLETE: 'IN_PROGRESS',
  READY_FOR_DEPLOYMENT: 'IN_PROGRESS',
  DEPLOYMENT: 'IN_PROGRESS',
  VALIDATION: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
};

/** Legacy statuses that predate the Initiative workflow, mapped for the board. */
const LEGACY_BOARD_MAP: Partial<Record<TaskStatus, InitiativeBoardStatus>> = {
  TODO: 'BACKLOG',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'COMPLETED',
};

/** The board column any Initiative status belongs in (never throws). */
export const initiativeBoardStatusOf = (status: TaskStatus): InitiativeBoardStatus => {
  // ON_HOLD is a side state — not part of the ordered chain, so the chain
  // membership check below would miss it.
  if (status === 'ON_HOLD') return 'ON_HOLD';
  const legacy = LEGACY_BOARD_MAP[status];
  if (legacy) return legacy;
  if (isChainStatus(status)) return CHAIN_TO_BOARD[status];
  return 'BACKLOG';
};

export interface InitiativeBoardMove {
  /** Board column the Initiative may move to. */
  to: InitiativeBoardStatus;
  /**
   * The ordered chain statuses such a board move persists. Board moves are
   * coarse: crossing one column boundary may advance (or rewind) several
   * chain steps, each of which is still validated one step at a time by the
   * store gate when applied in order.
   */
  steps: InitiativeWorkflowStatus[];
}

export interface InitiativeBoardMovePlan {
  ok: boolean;
  /** Ordered chain statuses to persist (empty when refused). */
  steps: InitiativeWorkflowStatus[];
  /** User-facing refusal reason when ok is false. */
  reason?: string;
}

/** Board columns along the active workflow flow (On Hold is a side lane). */
const BOARD_COLUMN_FLOW: readonly InitiativeBoardStatus[] = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
];

const boardColumnIndex = (status: InitiativeBoardStatus): number =>
  BOARD_COLUMN_FLOW.indexOf(status);

/**
 * Plans a board-column move as an ordered sequence of legal one-step chain
 * transitions. Rules:
 *   - only ADJACENT active columns may be crossed (Backlog <-> Planned <->
 *     In Progress <-> Completed); the chain is walked step by step until the
 *     first status that leaves the current column, which must be the target.
 *   - entering On Hold is a single chain step and obeys the classic rule
 *     (never from Backlog, never from Completed).
 *   - leaving On Hold is only the resume move back to the recorded status.
 *   - Completed is terminal — nothing leaves it.
 * Every emitted step is legal under canTransitionInitiative, so applying them
 * in order always passes the store's Initiative gate.
 */
export function planInitiativeBoardMove(
  status: TaskStatus,
  to: InitiativeBoardStatus,
  previousStatus?: TaskStatus
): InitiativeBoardMovePlan {
  const currentColumn = initiativeBoardStatusOf(status);
  if (currentColumn === to) {
    return {
      ok: false,
      steps: [],
      reason: `The Initiative is already in ${INITIATIVE_BOARD_STATUS_LABEL[to]}.`,
    };
  }
  if (currentColumn === 'COMPLETED') {
    return { ok: false, steps: [], reason: 'Completed is final — an Initiative cannot leave Completed.' };
  }
  if (currentColumn === 'ON_HOLD') {
    if (
      previousStatus !== undefined &&
      initiativeBoardStatusOf(previousStatus) === to &&
      canTransitionInitiative(status, previousStatus, previousStatus)
    ) {
      // canTransitionInitiative only allows chain statuses as resume targets.
      return { ok: true, steps: [previousStatus as InitiativeWorkflowStatus] };
    }
    return {
      ok: false,
      steps: [],
      reason:
        previousStatus !== undefined
          ? `The Initiative is On Hold — the only move is back to ${INITIATIVE_BOARD_STATUS_LABEL[initiativeBoardStatusOf(previousStatus)]}.`
          : 'The Initiative is On Hold and has no stage recorded to resume to.',
    };
  }
  if (to === 'ON_HOLD') {
    if (canTransitionInitiative(status, 'ON_HOLD', previousStatus)) {
      return { ok: true, steps: ['ON_HOLD'] };
    }
    return {
      ok: false,
      steps: [],
      reason: `An Initiative cannot go On Hold from ${getStatusLabel(status)}.`,
    };
  }

  const fromIdx = boardColumnIndex(currentColumn);
  const toIdx = boardColumnIndex(to);
  if (Math.abs(toIdx - fromIdx) !== 1) {
    return {
      ok: false,
      steps: [],
      reason: `Initiatives move one stage at a time — from ${INITIATIVE_BOARD_STATUS_LABEL[currentColumn]} you can only move to an adjacent stage.`,
    };
  }
  const forward = toIdx > fromIdx;

  const steps: InitiativeWorkflowStatus[] = [];
  let cursor: TaskStatus = status;
  for (let guard = 0; guard < INITIATIVE_WORKFLOW_CHAIN.length + 1; guard++) {
    const candidates = getAllowedInitiativeTransitions(cursor, undefined).filter((t) => {
      if (t === 'ON_HOLD') return false;
      const delta = chainIndex(t) - chainIndex(cursor);
      return forward ? delta > 0 : delta < 0;
    });
    if (candidates.length === 0) break;
    const next = candidates[0];
    steps.push(next);
    cursor = next;
    if (initiativeBoardStatusOf(next) === to) return { ok: true, steps };
    // Left the source column without landing on the target — refuse rather
    // than fabricate a multi-column jump.
    if (boardColumnIndex(initiativeBoardStatusOf(next)) !== fromIdx) break;
  }
  return {
    ok: false,
    steps: [],
    reason: `The Initiative cannot move to ${INITIATIVE_BOARD_STATUS_LABEL[to]} from ${getStatusLabel(status)} — move it one stage at a time.`,
  };
}

/**
 * The board columns an Initiative may move to from its current status —
 * adjacent active columns plus On Hold where the workflow allows it (and the
 * resume target while On Hold). Each move carries the ordered chain steps to
 * apply. Computed from the chain rules, never hardcoded.
 */
export function getAllowedInitiativeBoardMoves(
  status: TaskStatus,
  previousStatus?: TaskStatus
): InitiativeBoardMove[] {
  const currentColumn = initiativeBoardStatusOf(status);
  const moves: InitiativeBoardMove[] = [];

  if (currentColumn === 'ON_HOLD') {
    if (previousStatus !== undefined) {
      const resumeTo = initiativeBoardStatusOf(previousStatus);
      const plan = planInitiativeBoardMove(status, resumeTo, previousStatus);
      if (plan.ok) moves.push({ to: resumeTo, steps: plan.steps });
    }
    return moves;
  }
  if (currentColumn === 'COMPLETED') return moves;

  for (const column of BOARD_COLUMN_FLOW) {
    if (column === currentColumn) continue;
    const plan = planInitiativeBoardMove(status, column, previousStatus);
    if (plan.ok) moves.push({ to: column, steps: plan.steps });
  }
  const holdPlan = planInitiativeBoardMove(status, 'ON_HOLD', previousStatus);
  if (holdPlan.ok) moves.push({ to: 'ON_HOLD', steps: holdPlan.steps });
  return moves;
}

/**
 * The user-facing reason a board-column move was refused, in board language.
 */
export function explainInitiativeBoardMove(
  from: TaskStatus,
  to: InitiativeBoardStatus,
  previousStatus?: TaskStatus
): string {
  const plan = planInitiativeBoardMove(from, to, previousStatus);
  if (plan.ok) return '';
  if (plan.reason) return plan.reason;
  const moves = getAllowedInitiativeBoardMoves(from, previousStatus);
  if (moves.length === 0) {
    return `No moves are available from ${getStatusLabel(from)}.`;
  }
  return `Initiatives move one stage at a time — from here you can move to ${moves
    .map((m) => INITIATIVE_BOARD_STATUS_LABEL[m.to])
    .join(' or ')}.`;
}
