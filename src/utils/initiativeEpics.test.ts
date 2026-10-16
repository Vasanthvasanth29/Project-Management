import { describe, expect, it } from 'vitest';
import {
  linkEpicToInitiative,
  unlinkEpicFromInitiative,
  resolveLinkedEpics,
} from './initiativeEpics';
import { calculateInitiativeProgress, isInitiativeOverdue } from './initiativeProgress';
import type { Task, TaskStatus, WorkItemType } from '../types';

const BASE_TIME = '2026-01-01T00:00:00.000Z';

const makeTask = (
  id: string,
  type: WorkItemType,
  overrides: Partial<Task> = {}
): Task => ({
  id,
  projectId: 'proj-005',
  createdById: 'u-pm-01',
  title: id,
  description: '',
  type,
  status: 'TODO' as TaskStatus,
  priority: 'MEDIUM',
  tags: [],
  comments: [],
  attachments: [],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
  ...overrides,
});

const makeInitiative = (overrides: Partial<Task> = {}): Task =>
  makeTask('init-1', 'INITIATIVE', { status: 'BACKLOG', ...overrides });

const makeEpic = (overrides: Partial<Task> = {}): Task =>
  makeTask('epic-1', 'EPIC', { status: 'IN_PROGRESS', ...overrides });

describe('linkEpicToInitiative', () => {
  it('links an Epic from the same project and preserves existing ids', () => {
    const initiative = makeInitiative({ linkedEpicIds: ['epic-old'] });
    const epic = makeEpic();
    const res = linkEpicToInitiative(initiative, epic);
    expect(res.ok).toBe(true);
    expect(res.linkedEpicIds).toEqual(['epic-old', 'epic-1']);
  });

  it('prevents duplicate links', () => {
    const initiative = makeInitiative({ linkedEpicIds: ['epic-1'] });
    const res = linkEpicToInitiative(initiative, makeEpic());
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('already linked');
    expect(res.linkedEpicIds).toBeUndefined();
  });

  it('refuses Epics from another project (project boundaries)', () => {
    const initiative = makeInitiative({ projectId: 'proj-001' });
    const epic = makeEpic({ projectId: 'proj-005' });
    const res = linkEpicToInitiative(initiative, epic);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('project');
  });

  it('refuses non-Epic work items and non-Initiative hosts', () => {
    const initiative = makeInitiative();
    const story = makeTask('story-1', 'STORY');
    expect(linkEpicToInitiative(initiative, story).ok).toBe(false);
    expect(linkEpicToInitiative(story, makeEpic()).ok).toBe(false);
    expect(linkEpicToInitiative(undefined, makeEpic()).ok).toBe(false);
  });
});

describe('unlinkEpicFromInitiative', () => {
  it('removes only the requested Epic id', () => {
    const initiative = makeInitiative({ linkedEpicIds: ['epic-a', 'epic-b'] });
    const res = unlinkEpicFromInitiative(initiative, 'epic-a');
    expect(res.ok).toBe(true);
    expect(res.linkedEpicIds).toEqual(['epic-b']);
  });

  it('refuses to unlink an Epic that is not linked', () => {
    const initiative = makeInitiative({ linkedEpicIds: ['epic-a'] });
    const res = unlinkEpicFromInitiative(initiative, 'epic-x');
    expect(res.ok).toBe(false);
  });
});

describe('resolveLinkedEpics', () => {
  it('resolves linked ids in order and skips missing or non-Epic records', () => {
    const epic = makeEpic({ id: 'epic-a', title: 'Alpha' });
    const story = makeTask('story-1', 'STORY');
    const initiative = makeInitiative({ linkedEpicIds: ['epic-a', 'deleted-epic', 'story-1'] });
    const resolved = resolveLinkedEpics(initiative, [story, epic]);
    expect(resolved.map((t) => t.id)).toEqual(['epic-a']);
  });
});

describe('calculateInitiativeProgress', () => {
  const tree = [
    makeInitiative({ linkedEpicIds: ['epic-a'] }),
    makeEpic({ id: 'epic-a', status: 'IN_PROGRESS' }),
    makeTask('story-1', 'STORY', { parentId: 'epic-a', status: 'DONE' }),
    makeTask('task-1', 'TASK', { parentId: 'epic-a', status: 'IN_PROGRESS' }),
    makeTask('sub-1', 'SUB-TASK', { parentId: 'task-1', status: 'DONE' }),
    // Unrelated work outside the linked Epic subtree — never counted.
    makeTask('story-x', 'STORY', { parentId: 'epic-z', status: 'DONE' }),
    makeEpic({ id: 'epic-z', status: 'DONE' }),
  ];

  it('measures only the linked Epic subtree (epic + descendants)', () => {
    const progress = calculateInitiativeProgress(tree[0], tree);
    expect(progress.total).toBe(4); // epic-a + story-1 + task-1 + sub-1
    expect(progress.completed).toBe(2); // story-1, sub-1
    expect(progress.percent).toBe(50);
    expect(progress.hasLinkedWork).toBe(true);
  });

  it('reports null percent when nothing is linked (no fabricated 0%)', () => {
    const empty = makeInitiative();
    const progress = calculateInitiativeProgress(empty, [empty, ...tree.slice(1)]);
    expect(progress.percent).toBeNull();
    expect(progress.hasLinkedWork).toBe(false);
    expect(progress.total).toBe(0);
  });

  it('never counts work from other projects or unlinked Epics', () => {
    const initiative = makeInitiative({ projectId: 'proj-001', linkedEpicIds: [] });
    const foreignDone = makeTask('story-f', 'STORY', {
      projectId: 'proj-002',
      status: 'DONE',
    });
    const progress = calculateInitiativeProgress(initiative, [initiative, foreignDone]);
    expect(progress.total).toBe(0);
    expect(progress.percent).toBeNull();
  });

  it('treats cancelled work as not completed', () => {
    const initiative = makeInitiative({ linkedEpicIds: ['epic-a'] });
    const epic = makeEpic({ id: 'epic-a' });
    const cancelled = makeTask('story-c', 'STORY', {
      parentId: 'epic-a',
      status: 'DONE',
      resolution: 'CANCELLED',
    });
    const progress = calculateInitiativeProgress(initiative, [initiative, epic, cancelled]);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(0);
  });
});

describe('isInitiativeOverdue', () => {
  it('is overdue when the target date has passed and the Initiative is not Completed', () => {
    const initiative = makeInitiative({
      status: 'IN_DEVELOPMENT',
      dueDate: '2020-01-01T00:00:00.000Z',
    });
    expect(isInitiativeOverdue(initiative)).toBe(true);
  });

  it('is never overdue once Completed', () => {
    const initiative = makeInitiative({
      status: 'COMPLETED',
      dueDate: '2020-01-01T00:00:00.000Z',
    });
    expect(isInitiativeOverdue(initiative)).toBe(false);
  });

  it('is not overdue without a target date', () => {
    expect(isInitiativeOverdue(makeInitiative({ status: 'IN_DEVELOPMENT' }))).toBe(false);
  });
});
