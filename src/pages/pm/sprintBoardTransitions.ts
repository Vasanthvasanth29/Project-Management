import type { TaskStatus } from '../../types';

// The Live Iteration board renders exactly three columns. Every workflow status the
// store can hold maps onto one of them, and the directional transition matrix below
// is the single source of truth for what a drag (or a detail-view button) may do.
export type BoardColumn = 'TODO' | 'IN_PROGRESS' | 'DONE';

export const BOARD_COLUMNS: BoardColumn[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export const columnLabel: Record<BoardColumn, string> = {
  TODO: 'TO DO',
  IN_PROGRESS: 'IN PROGRESS',
  DONE: 'DONE',
};

// Any status outside TODO/DONE (IN_REVIEW, TESTING, BUG_FIX, RETEST, BLOCKED…)
// belongs to the middle column. Cancelled is a terminal outcome: it sits in the
// DONE column rendered with the grey Cancelled chip (it never counts as done).
export const columnOfStatus = (status: string): BoardColumn => {
  if (status === 'DONE' || status === 'CANCELLED') return 'DONE';
  if (status === 'TODO') return 'TODO';
  return 'IN_PROGRESS';
};

export const statusForColumn = (column: BoardColumn): TaskStatus => column;

// Directional matrix: TO DO -> IN PROGRESS only; IN PROGRESS -> TO DO or DONE;
// DONE -> IN PROGRESS only. Same-column drops are reorders, never transitions.
const VALID_TRANSITIONS: Record<BoardColumn, BoardColumn[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'DONE'],
  DONE: ['IN_PROGRESS'],
};

export const canTransition = (from: BoardColumn, to: BoardColumn): boolean =>
  from !== to && VALID_TRANSITIONS[from].includes(to);

// A column accepts the dragged card when it is the same column (reorder) or the
// matrix allows the move. Invalid pairs must NOT be preventDefault-ed during
// dragover so the browser refuses the drop entirely.
export const isValidDropTarget = (from: BoardColumn, to: BoardColumn): boolean =>
  from === to || canTransition(from, to);

// Transitions that require an (optional) comment step before the status changes:
// starting work, sending work back, and finishing work. Returning a finished card
// to IN PROGRESS applies immediately.
const COMMENT_REQUIRED: ReadonlyArray<readonly [BoardColumn, BoardColumn]> = [
  ['TODO', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'TODO'],
  ['IN_PROGRESS', 'DONE'],
];

export const needsComment = (from: BoardColumn, to: BoardColumn): boolean =>
  COMMENT_REQUIRED.some(([f, t]) => f === from && t === to);
