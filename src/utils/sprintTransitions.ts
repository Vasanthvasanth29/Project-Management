import type { TaskStatus } from '../types';

// The Live Iteration board collapses the full TaskStatus enum into exactly
// three Kanban columns, per the directional workflow the product requires.
export type BoardColumn = 'TODO' | 'IN_PROGRESS' | 'DONE';

export const BOARD_COLUMNS: { key: BoardColumn; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Done' },
];

export const statusToColumn = (status: TaskStatus): BoardColumn => {
  if (status === 'DONE' || status === 'CANCELLED') return 'DONE';
  if (
    status === 'IN_PROGRESS' ||
    status === 'IN_REVIEW' ||
    status === 'TESTING' ||
    status === 'BUG_FIX' ||
    status === 'RETEST'
  ) {
    return 'IN_PROGRESS';
  }
  return 'TODO'; // TODO, BLOCKED
};

// The representative TaskStatus written back to the store when a card lands
// in a given column (a drop always normalizes to the column's primary status).
export const columnToStatus = (column: BoardColumn): TaskStatus => {
  if (column === 'DONE') return 'DONE';
  if (column === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'TODO';
};

// Explicit transition matrix: TO DO <-> IN PROGRESS <-> DONE only.
// Direct TO DO <-> DONE jumps are never allowed in either direction.
export const canTransition = (from: BoardColumn, to: BoardColumn): boolean => {
  if (from === to) return true; // same-column reorder
  if (from === 'TODO' && to === 'IN_PROGRESS') return true;
  if (from === 'IN_PROGRESS' && to === 'TODO') return true;
  if (from === 'IN_PROGRESS' && to === 'DONE') return true;
  if (from === 'DONE' && to === 'IN_PROGRESS') return true;
  return false; // TO DO -> DONE, DONE -> TO DO
};

// Whether the transition must go through the optional comment/screenshot modal.
export const needsComment = (from: BoardColumn, to: BoardColumn): boolean => {
  if (from === to) return false;
  if (from === 'DONE' && to === 'IN_PROGRESS') return false;
  return canTransition(from, to);
};
