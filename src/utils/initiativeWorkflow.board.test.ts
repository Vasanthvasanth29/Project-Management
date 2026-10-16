import { describe, expect, it } from 'vitest';
import {
  INITIATIVE_BOARD_STATUSES,
  initiativeBoardStatusOf,
  planInitiativeBoardMove,
  getAllowedInitiativeBoardMoves,
  explainInitiativeBoardMove,
} from './initiativeWorkflow';
import type { InitiativeWorkflowStatus, TaskStatus } from '../types';

/**
 * Board-layer tests: the 5-column Initiative Board is a view over the chain —
 * every board move must decompose into legal one-step chain transitions.
 */

describe('initiativeBoardStatusOf', () => {
  it('maps every chain status onto its board column', () => {
    expect(initiativeBoardStatusOf('BACKLOG')).toBe('BACKLOG');
    expect(initiativeBoardStatusOf('ASSESSMENT')).toBe('BACKLOG');
    expect(initiativeBoardStatusOf('ON_BOARD')).toBe('PLANNED');
    expect(initiativeBoardStatusOf('READY_FOR_DEVELOPMENT')).toBe('PLANNED');
    expect(initiativeBoardStatusOf('IN_DEVELOPMENT')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('DEVELOPMENT_COMPLETE')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('READY_FOR_DEPLOYMENT')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('DEPLOYMENT')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('VALIDATION')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('COMPLETED')).toBe('COMPLETED');
    expect(initiativeBoardStatusOf('ON_HOLD')).toBe('ON_HOLD');
  });

  it('maps legacy statuses onto sane columns', () => {
    expect(initiativeBoardStatusOf('TODO')).toBe('BACKLOG');
    expect(initiativeBoardStatusOf('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(initiativeBoardStatusOf('DONE')).toBe('COMPLETED');
  });

  it('covers every declared board status', () => {
    const covered = new Set(INITIATIVE_BOARD_STATUSES);
    expect(covered.has(initiativeBoardStatusOf('BACKLOG'))).toBe(true);
    expect(covered.has(initiativeBoardStatusOf('ON_HOLD'))).toBe(true);
    expect(covered.has(initiativeBoardStatusOf('COMPLETED'))).toBe(true);
  });
});

describe('planInitiativeBoardMove', () => {
  it('advances BACKLOG -> PLANNED through the chain steps ASSESSMENT then ON_BOARD', () => {
    const plan = planInitiativeBoardMove('BACKLOG', 'PLANNED');
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual(['ASSESSMENT', 'ON_BOARD']);
  });

  it('advances PLANNED -> IN_PROGRESS from ON_BOARD in two chain steps', () => {
    const plan = planInitiativeBoardMove('ON_BOARD', 'IN_PROGRESS');
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual(['READY_FOR_DEVELOPMENT', 'IN_DEVELOPMENT']);
  });

  it('advances IN_PROGRESS -> COMPLETED across the remaining chain', () => {
    const plan = planInitiativeBoardMove('IN_DEVELOPMENT', 'COMPLETED');
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual([
      'DEVELOPMENT_COMPLETE',
      'READY_FOR_DEPLOYMENT',
      'DEPLOYMENT',
      'VALIDATION',
      'COMPLETED',
    ]);
    // Every emitted step is a legal one-step chain transition.
    let cursor: TaskStatus = 'IN_DEVELOPMENT';
    for (const step of plan.steps) {
      const allowedNext = step;
      expect(Math.abs(chainDelta(cursor, allowedNext))).toBe(1);
      cursor = step;
    }
  });

  it('moves backward one column at a time', () => {
    const plan = planInitiativeBoardMove('IN_DEVELOPMENT', 'PLANNED');
    expect(plan.ok).toBe(true);
    // One backward chain step (READY_FOR_DEVELOPMENT) already lands in PLANNED.
    expect(plan.steps).toEqual(['READY_FOR_DEVELOPMENT']);
  });

  it('refuses non-adjacent column jumps', () => {
    expect(planInitiativeBoardMove('BACKLOG', 'IN_PROGRESS').ok).toBe(false);
    expect(planInitiativeBoardMove('BACKLOG', 'COMPLETED').ok).toBe(false);
    expect(planInitiativeBoardMove('ON_BOARD', 'COMPLETED').ok).toBe(false);
  });

  it('refuses a move within the same column', () => {
    const plan = planInitiativeBoardMove('ASSESSMENT', 'BACKLOG');
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain('already in Backlog');
  });

  it('enters ON_HOLD in one chain step from an intermediate stage', () => {
    const plan = planInitiativeBoardMove('IN_DEVELOPMENT', 'ON_HOLD');
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual(['ON_HOLD']);
  });

  it('refuses ON_HOLD from BACKLOG (workflow rule)', () => {
    const plan = planInitiativeBoardMove('BACKLOG', 'ON_HOLD');
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain('On Hold');
  });

  it('resumes ON_HOLD only to the recorded previous status', () => {
    const plan = planInitiativeBoardMove('ON_HOLD', 'IN_PROGRESS', 'IN_DEVELOPMENT');
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual(['IN_DEVELOPMENT']);

    const wrong = planInitiativeBoardMove('ON_HOLD', 'PLANNED', 'IN_DEVELOPMENT');
    expect(wrong.ok).toBe(false);
  });

  it('refuses any move out of COMPLETED (terminal)', () => {
    expect(planInitiativeBoardMove('COMPLETED', 'IN_PROGRESS').ok).toBe(false);
    expect(planInitiativeBoardMove('COMPLETED', 'ON_HOLD').ok).toBe(false);
    expect(planInitiativeBoardMove('COMPLETED', 'BACKLOG').reason).toContain('final');
  });
});

describe('getAllowedInitiativeBoardMoves', () => {
  it('offers only adjacent columns plus On Hold from an active stage', () => {
    const moves = getAllowedInitiativeBoardMoves('ON_BOARD');
    expect(moves.map((m) => m.to).sort()).toEqual(['BACKLOG', 'IN_PROGRESS', 'ON_HOLD']);
  });

  it('offers nothing from Completed', () => {
    expect(getAllowedInitiativeBoardMoves('COMPLETED')).toEqual([]);
  });

  it('offers only the resume target while On Hold', () => {
    const moves = getAllowedInitiativeBoardMoves('ON_HOLD', 'READY_FOR_DEVELOPMENT');
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toBe('PLANNED');
    expect(moves[0].steps).toEqual(['READY_FOR_DEVELOPMENT']);
  });
});

describe('explainInitiativeBoardMove', () => {
  it('explains a refused jump in board language', () => {
    const msg = explainInitiativeBoardMove('BACKLOG', 'COMPLETED');
    expect(msg).toContain('one stage at a time');
  });

  it('returns an empty string for a legal move', () => {
    expect(explainInitiativeBoardMove('BACKLOG', 'PLANNED')).toBe('');
  });
});

/** Chain distance between two statuses (test-local helper). */
function chainDelta(from: TaskStatus, to: TaskStatus): number {
  const chain: TaskStatus[] = [
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
  return chain.indexOf(to) - chain.indexOf(from);
}
