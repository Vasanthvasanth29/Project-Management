import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';
import {
  planInitiativeBoardMove,
  initiativeBoardStatusOf,
} from '../utils/initiativeWorkflow';
import { linkEpicToInitiative, unlinkEpicFromInitiative } from '../utils/initiativeEpics';
import { calculateInitiativeProgress } from '../utils/initiativeProgress';
import type { InitiativeWorkflowStatus } from '../types';

const initialState = useAppStore.getState();
const store = () => useAppStore.getState();

const init030 = () => store().tasks.find((t) => t.id === 'init-030')!;
const epic032 = () => store().tasks.find((t) => t.id === 'epic-032')!;

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState(initialState);
});

describe('Initiative CRUD', () => {
  it('creates an Initiative at BACKLOG with a minted issue key', () => {
    const created = store().createTask({
      projectId: 'proj-001',
      title: 'New Portfolio Initiative',
      description: 'desc',
      type: 'INITIATIVE',
      status: 'COMPLETED' as InitiativeWorkflowStatus, // never trusted for INITIATIVE
      priority: 'HIGH',
      createdById: 'u-pm-01',
      tags: [],
      comments: [],
      attachments: [],
    });
    expect(created.status).toBe('BACKLOG');
    expect(created.issueKey).toBeDefined();
    expect(store().tasks.some((t) => t.id === created.id)).toBe(true);
  });

  it('edits Initiative fields through updateTask', () => {
    store().updateTask('init-030', {
      title: 'Renamed Portfolio',
      priority: 'CRITICAL',
      assigneeId: 'u-tl-01',
    });
    const t = init030();
    expect(t.title).toBe('Renamed Portfolio');
    expect(t.priority).toBe('CRITICAL');
    expect(t.assigneeId).toBe('u-tl-01');
  });

  it('archives and restores an Initiative via the isArchived flag', () => {
    store().updateTask('init-030', { isArchived: true });
    expect(init030().isArchived).toBe(true);
    // Work items and links are kept — archiving is a soft flag only.
    expect(store().tasks.some((t) => t.id === 'epic-032')).toBe(true);
    expect(init030().linkedEpicIds).toEqual(['epic-032']);

    store().updateTask('init-030', { isArchived: false });
    expect(init030().isArchived).toBe(false);
  });
});

describe('Initiative status transitions (store gate)', () => {
  it('accepts a legal one-step chain move', () => {
    // Seed init-030 is IN_DEVELOPMENT -> one step forward is legal.
    const res = store().updateTaskStatus('init-030', 'DEVELOPMENT_COMPLETE', 'u-pm-01');
    expect(res.ok).toBe(true);
    expect(init030().status).toBe('DEVELOPMENT_COMPLETE');
  });

  it('refuses an illegal multi-step jump with a reason', () => {
    const res = store().updateTaskStatus('init-030', 'COMPLETED', 'u-pm-01');
    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
    expect(init030().status).toBe('IN_DEVELOPMENT');
  });

  it('supports ON_HOLD entry and resume to the recorded stage', () => {
    const hold = store().updateTaskStatus('init-030', 'ON_HOLD', 'u-pm-01');
    expect(hold.ok).toBe(true);
    expect(init030().status).toBe('ON_HOLD');
    expect(init030().initiativePreviousStatus).toBe('IN_DEVELOPMENT');

    // While On Hold, only the resume target is legal.
    expect(store().updateTaskStatus('init-030', 'DEPLOYMENT', 'u-pm-01').ok).toBe(false);

    const resume = store().updateTaskStatus('init-030', 'IN_DEVELOPMENT', 'u-pm-01');
    expect(resume.ok).toBe(true);
    expect(init030().status).toBe('IN_DEVELOPMENT');
    expect(init030().initiativePreviousStatus).toBeUndefined();
  });

  it('treats COMPLETED as terminal', () => {
    // March the chain legally to COMPLETED.
    for (const step of [
      'DEVELOPMENT_COMPLETE',
      'READY_FOR_DEPLOYMENT',
      'DEPLOYMENT',
      'VALIDATION',
      'COMPLETED',
    ] as InitiativeWorkflowStatus[]) {
      const res = store().updateTaskStatus('init-030', step, 'u-pm-01');
      expect(res.ok).toBe(true);
    }
    expect(init030().status).toBe('COMPLETED');

    for (const to of ['BACKLOG', 'IN_DEVELOPMENT', 'ON_HOLD', 'VALIDATION'] as InitiativeWorkflowStatus[]) {
      const res = store().updateTaskStatus('init-030', to, 'u-pm-01');
      expect(res.ok).toBe(false);
      expect(res.reason).toContain('final');
    }
    expect(init030().status).toBe('COMPLETED');
  });
});

describe('Initiative Board moves through the store', () => {
  it('applies a BACKLOG -> PLANNED board move as two legal chain steps', () => {
    const created = store().createTask({
      projectId: 'proj-001',
      title: 'Board Move Initiative',
      description: '',
      type: 'INITIATIVE',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      createdById: 'u-pm-01',
      tags: [],
      comments: [],
      attachments: [],
    });
    const plan = planInitiativeBoardMove('BACKLOG', 'PLANNED');
    expect(plan.ok).toBe(true);
    for (const step of plan.steps) {
      expect(store().updateTaskStatus(created.id, step, 'u-pm-01').ok).toBe(true);
    }
    const after = store().tasks.find((t) => t.id === created.id)!;
    expect(after.status).toBe('ON_BOARD');
    expect(initiativeBoardStatusOf(after.status)).toBe('PLANNED');
  });

  it('refuses a non-adjacent board jump at the store level', () => {
    const plan = planInitiativeBoardMove('IN_DEVELOPMENT', 'BACKLOG');
    expect(plan.ok).toBe(false);
    const res = store().updateTaskStatus('init-030', 'BACKLOG', 'u-pm-01');
    expect(res.ok).toBe(false);
  });
});

describe('Initiative <-> Epic linking (store level)', () => {
  it('links an Epic by writing only the Initiative side; the Epic is untouched', () => {
    // Fresh initiative (init-030 already links epic-032).
    const created = store().createTask({
      projectId: 'proj-005',
      title: 'Linking Initiative',
      description: '',
      type: 'INITIATIVE',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      createdById: 'u-pm-01',
      tags: [],
      comments: [],
      attachments: [],
    });
    const epicBefore = JSON.stringify(epic032());
    const res = linkEpicToInitiative(store().tasks.find((t) => t.id === created.id)!, epic032());
    expect(res.ok).toBe(true);
    store().updateTask(created.id, { linkedEpicIds: res.linkedEpicIds });

    expect(store().tasks.find((t) => t.id === created.id)!.linkedEpicIds).toContain('epic-032');
    // Preserve Epic ids and project relationships — the Epic record is unchanged.
    expect(JSON.stringify(epic032())).toBe(epicBefore);
  });

  it('prevents duplicate links on an already-linked Initiative', () => {
    const res = linkEpicToInitiative(init030(), epic032());
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('already linked');
  });

  it('prevents cross-project links', () => {
    const foreignEpic = store().tasks.find((t) => t.type === 'EPIC' && t.projectId !== 'proj-005')!;
    const res = linkEpicToInitiative(init030(), foreignEpic);
    expect(res.ok).toBe(false);
  });

  it('unlinks an Epic without deleting or duplicating anything', () => {
    const res = unlinkEpicFromInitiative(init030(), 'epic-032');
    expect(res.ok).toBe(true);
    store().updateTask('init-030', { linkedEpicIds: res.linkedEpicIds });
    expect(init030().linkedEpicIds).toEqual([]);
    // The Epic itself still exists with its own relationships.
    expect(store().tasks.some((t) => t.id === 'epic-032')).toBe(true);
    expect(epic032().parentId).toBe('feat-031');
  });
});

describe('Initiative progress from linked work (store level)', () => {
  it('computes progress from the linked Epic subtree only', () => {
    // init-030 links epic-032; its subtree is epic-032 + story-033 + task-034 + subtask-035.
    const progress = calculateInitiativeProgress(init030(), store().tasks);
    expect(progress.total).toBe(4);
    expect(progress.completed).toBe(1); // subtask-035 is DONE
    expect(progress.percent).toBe(25);
  });

  it('reports no tracked progress for an Initiative with no linked work', () => {
    const created = store().createTask({
      projectId: 'proj-005',
      title: 'Unlinked Initiative',
      description: '',
      type: 'INITIATIVE',
      status: 'BACKLOG',
      priority: 'LOW',
      createdById: 'u-pm-01',
      tags: [],
      comments: [],
      attachments: [],
    });
    const progress = calculateInitiativeProgress(created, store().tasks);
    expect(progress.percent).toBeNull();
    expect(progress.hasLinkedWork).toBe(false);
  });
});
