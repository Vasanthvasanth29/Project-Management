import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './appStore';
import { projects as seedProjects, tasks as seedTasks } from '../data/mockData';
import {
  PROJECT_IDENTITY_STORAGE_KEY,
  readProjectIdentityOverrides,
} from '../utils/projectIdentityPersistence';
import {
  readPersistedIssueLinks,
  rekeyPersistedIssueLinks,
  reconcilePersistedIssueLinks,
  type PersistedIssueLink,
} from '../utils/issueLinkPersistence';
import type { Activity, Notification, Sprint } from '../types';

/** Same key issueLinkPersistence writes to (not exported from that module). */
const LINKS_KEY = 'flowexec_issue_links_v1';

const initialState = useAppStore.getState();

const store = () => useAppStore.getState();

const identityActivities = (kind: 'name' | 'key'): Activity[] =>
  store().activities.filter((a) => a.metadata?.identityChange === kind);

const notif = (id: string): Notification | undefined =>
  store().notifications.find((n) => n.id === id);

const seedTask = (id: string) => seedTasks.find((t) => t.id === id)!;

const linkRecord = (overrides: Partial<PersistedIssueLink> = {}): PersistedIssueLink => ({
  id: 'link-1',
  fromKey: 'ECOMM-900',
  fromTitle: 'Checkout & Cart',
  fromProjectId: 'proj-001',
  toKey: 'ECOMM-761',
  toTitle: 'Checkout & Cart Delivery',
  toProjectId: 'proj-001',
  type: 'BLOCKS',
  createdAt: '2024-09-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState(initialState);
});

describe('R-1: rename/rekey survives a refresh (identity persistence)', () => {
  it('persists name + key together, keyed by the immutable project id', () => {
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');
    expect(readProjectIdentityOverrides()['proj-001']).toEqual({
      name: 'Shop Platform',
      key: 'ECOMM4.0',
    });

    localStorage.clear();
    useAppStore.setState(initialState);
    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');
    expect(readProjectIdentityOverrides()['proj-001']).toEqual({
      name: 'E-Commerce Platform',
      key: 'SHOP1.0',
    });
  });

  it('removes the override again when the identity is back to its seed values', () => {
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');
    expect(readProjectIdentityOverrides()['proj-001']).toBeDefined();

    store().updateProject('proj-001', { name: 'E-Commerce Platform' }, 'u-admin-01');
    expect(readProjectIdentityOverrides()['proj-001']).toBeUndefined();
  });

  it('applies the persisted identity to freshly seeded projects after a refresh', async () => {
    store().updateProject(
      'proj-001',
      { name: 'Shop Platform', key: 'SHOP1.0' },
      'u-admin-01'
    );
    expect(readProjectIdentityOverrides()['proj-001']).toEqual({
      name: 'Shop Platform',
      key: 'SHOP1.0',
    });

    vi.resetModules();
    const fresh = await import('./appStore');
    await new Promise((r) => setTimeout(r, 0));

    const freshProjects = fresh.useAppStore.getState().projects;
    const p1 = freshProjects.find((p) => p.id === 'proj-001')!;
    expect(p1.name).toBe('Shop Platform');
    expect(p1.key).toBe('SHOP1.0');
    // Other projects keep their untouched seed identity.
    expect(freshProjects.find((p) => p.id === 'proj-002')!.name).toBe(
      'Hospital Management System'
    );
  });

  it('drops the persisted identity when the project is deleted', () => {
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');
    expect(readProjectIdentityOverrides()['proj-001']).toBeDefined();

    store().deleteProject('proj-001');
    expect(readProjectIdentityOverrides()['proj-001']).toBeUndefined();
  });
});

describe('R-1: persisted issue links stay resolvable across rekeys/refreshes', () => {
  it('rekeys stored link ends in place, preserving everything else', () => {
    localStorage.setItem(
      LINKS_KEY,
      JSON.stringify([
        linkRecord(),
        linkRecord({
          id: 'link-2',
          fromKey: 'HMS-1',
          fromProjectId: 'proj-002',
          toKey: 'HMS-2',
          toProjectId: 'proj-002',
        }),
      ])
    );

    rekeyPersistedIssueLinks('proj-001', 'ECOMM', 'SHOP');

    const links = readPersistedIssueLinks();
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      id: 'link-1',
      fromKey: 'SHOP-900',
      toKey: 'SHOP-761',
      fromProjectId: 'proj-001',
      toTitle: 'Checkout & Cart Delivery',
      createdAt: '2024-09-01T00:00:00.000Z',
    });
    // Another project's link is never touched.
    expect(links[1]).toMatchObject({ fromKey: 'HMS-1', toKey: 'HMS-2' });
  });

  it('reconciles stale stored keys to the owning project’s current prefix', () => {
    localStorage.setItem(
      LINKS_KEY,
      JSON.stringify([
        linkRecord(),
        linkRecord({
          id: 'link-2',
          fromKey: 'LEGACY-1',
          fromProjectId: 'proj-does-not-exist',
          toKey: 'LEGACY-2',
          toProjectId: 'proj-does-not-exist',
        }),
      ])
    );

    const projects = seedProjects.map((p) =>
      p.id === 'proj-001' ? { ...p, key: 'SHOP1.0' } : p
    );
    reconcilePersistedIssueLinks(projects);

    const links = readPersistedIssueLinks();
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      id: 'link-1',
      fromKey: 'SHOP-900',
      toKey: 'SHOP-761',
      createdAt: '2024-09-01T00:00:00.000Z',
    });
    // Keys of projects that no longer exist stay as-is; records are updated
    // in place — no duplicates, ids preserved.
    expect(links[1]).toMatchObject({ fromKey: 'LEGACY-1', toKey: 'LEGACY-2' });
  });

  it('resolves both ends of a persisted link after a refresh', async () => {
    // Identity override says the project is rekeyed; links already rekeyed.
    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');
    const record = linkRecord({ fromKey: 'SHOP-900', toKey: 'SHOP-761' });
    localStorage.setItem(LINKS_KEY, JSON.stringify([record]));

    vi.resetModules();
    const fresh = await import('./appStore');
    const freshLinks = await import('../utils/issueLinkPersistence');
    await new Promise((r) => setTimeout(r, 0));

    const freshStore = fresh.useAppStore.getState();
    // Identity survived the refresh...
    expect(freshStore.projects.find((p) => p.id === 'proj-001')!.key).toBe('SHOP1.0');
    // ...while the store re-seeded its tasks with their original keys...
    expect(freshStore.tasks.find((t) => t.id === 'task-050')!.issueKey).toBe('ECOMM-900');
    // ...and the stored link still resolves to the same two tasks.
    const resolved = freshLinks.resolvePersistedIssueLink(record);
    expect(resolved?.from.id).toBe('task-050');
    expect(resolved?.to.id).toBe('task-051');
  });

  it('heals stale link keys written under an old prefix at startup', async () => {
    // Legacy divergence: identity override is on SHOP while the stored link
    // still carries ECOMM keys (e.g. written before the fix existed).
    localStorage.setItem(
      PROJECT_IDENTITY_STORAGE_KEY,
      JSON.stringify({ 'proj-001': { name: 'E-Commerce Platform', key: 'SHOP1.0' } })
    );
    localStorage.setItem(LINKS_KEY, JSON.stringify([linkRecord()]));

    vi.resetModules();
    await import('./appStore');
    await new Promise((r) => setTimeout(r, 0));

    const links = readPersistedIssueLinks();
    expect(links[0]).toMatchObject({
      id: 'link-1',
      fromKey: 'SHOP-900',
      toKey: 'SHOP-761',
      fromTitle: 'Checkout & Cart',
    });
  });
});

describe('R-2: rename/rekey writes audit activities', () => {
  it('writes exactly one rename activity with actor, old and new name', () => {
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');

    const nameActs = identityActivities('name');
    expect(nameActs).toHaveLength(1);
    expect(nameActs[0]).toMatchObject({
      action: 'renamed project from "E-Commerce Platform" to',
      entityTitle: 'Shop Platform',
      entityType: 'PROJECT',
      entityId: 'proj-001',
      userId: 'u-admin-01',
      organizationId: 'org-001',
      projectId: 'proj-001',
    });
    // A name-only save must not fabricate a key activity.
    expect(identityActivities('key')).toHaveLength(0);
  });

  it('writes exactly one key activity with old and new key', () => {
    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');

    const keyActs = identityActivities('key');
    expect(keyActs).toHaveLength(1);
    expect(keyActs[0]).toMatchObject({
      action: 'changed project key from "ECOMM4.0" to',
      entityTitle: 'SHOP1.0',
      entityType: 'PROJECT',
      entityId: 'proj-001',
      userId: 'u-admin-01',
    });
    expect(identityActivities('name')).toHaveLength(0);
  });

  it('writes one activity per changed field when both change in one save', () => {
    store().updateProject(
      'proj-001',
      { name: 'Shop Platform', key: 'SHOP1.0' },
      'u-admin-01'
    );

    expect(identityActivities('name')).toHaveLength(1);
    expect(identityActivities('key')).toHaveLength(1);
  });

  it('writes no activity for a save that changes nothing and does not repeat on re-save', () => {
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');
    expect(identityActivities('name')).toHaveLength(1);

    // Same name again: no duplicate entry.
    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');
    expect(identityActivities('name')).toHaveLength(1);

    // Non-identity field: still no identity activity.
    store().updateProject('proj-001', { description: 'Updated description' }, 'u-admin-01');
    expect(identityActivities('name')).toHaveLength(1);
    expect(identityActivities('key')).toHaveLength(0);
  });

  it('updates denormalized PROJECT activity titles but keeps identity history immutable', () => {
    store().updateProject('proj-001', { name: 'First Rename' }, 'u-admin-01');
    store().updateProject('proj-001', { name: 'Second Rename' }, 'u-admin-01');

    // Seed activities track the current name...
    expect(store().activities.find((a) => a.id === 'act-009')!.entityTitle).toBe(
      'Second Rename'
    );
    expect(store().activities.find((a) => a.id === 'act-010')!.entityTitle).toBe(
      'Second Rename'
    );

    // ...while the first rename's audit entry still shows what it recorded.
    const nameActs = identityActivities('name');
    expect(nameActs).toHaveLength(2);
    expect(nameActs.map((a) => a.entityTitle)).toEqual(
      expect.arrayContaining(['First Rename', 'Second Rename'])
    );
    const first = nameActs.find((a) => a.entityTitle === 'First Rename')!;
    expect(first.action).toBe('renamed project from "E-Commerce Platform" to');
  });
});

describe('R-3: notification updates are scoped to the renamed project only', () => {
  const seedName = 'E-Commerce Platform';
  const renamedTo = 'Shop Platform';

  it("updates only this project's notifications (seed notif-003) and keeps metadata", () => {
    const before = notif('notif-003')!;
    expect(before.message).toContain(seedName);

    store().updateProject('proj-001', { name: renamedTo }, 'u-admin-01');

    const after = notif('notif-003')!;
    expect(after.message).toBe(
      'Shop Platform was assigned to Rahul Kumar.'
    );
    expect(after.id).toBe(before.id);
    expect(after.read).toBe(before.read);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.title).toBe(before.title);
  });

  it("never touches another project's PROJECT-typed notification (the old OR-scope bug)", () => {
    const foreign: Notification = {
      id: 'notif-other-proj',
      userId: 'u-admin-01',
      type: 'PROJECT_ASSIGNED',
      title: 'Project Created',
      message: `${seedName} was assigned to Rahul Kumar.`,
      read: false,
      relatedEntityId: 'proj-002',
      relatedEntityType: 'PROJECT',
      createdAt: '2024-06-15T09:00:00Z',
    };
    useAppStore.setState({ notifications: [...store().notifications, foreign] });

    store().updateProject('proj-001', { name: renamedTo }, 'u-admin-01');

    expect(notif('notif-other-proj')!.message).toBe(
      `${seedName} was assigned to Rahul Kumar.`
    );
  });

  it('leaves sprint/task-scoped notifications untouched (historical records)', () => {
    const sprintScoped: Notification = {
      id: 'notif-sprint-scoped',
      userId: 'u-pm-01',
      type: 'SPRINT_STARTED',
      title: 'Sprint Active',
      message: `${seedName} iteration 4 is now active.`,
      read: true,
      relatedEntityId: 'spr-001',
      relatedEntityType: 'SPRINT',
      createdAt: '2024-09-01T07:00:00Z',
    };
    useAppStore.setState({ notifications: [...store().notifications, sprintScoped] });

    store().updateProject('proj-001', { name: renamedTo }, 'u-admin-01');

    expect(notif('notif-sprint-scoped')!.message).toBe(
      `${seedName} iteration 4 is now active.`
    );
  });

  it("rekeys issue prefixes only in this project's notifications", () => {
    const projectScoped: Notification = {
      id: 'notif-proj-prefix',
      userId: 'u-pm-01',
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: 'ECOMM-900 has been added to the iteration.',
      read: false,
      relatedEntityId: 'proj-001',
      relatedEntityType: 'PROJECT',
      createdAt: '2024-09-04T08:00:00Z',
    };
    const sprintScoped: Notification = {
      id: 'notif-sprint-prefix',
      userId: 'u-pm-01',
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: 'ECOMM-761 has been added to the iteration.',
      read: false,
      relatedEntityId: 'spr-001',
      relatedEntityType: 'SPRINT',
      createdAt: '2024-09-04T08:00:00Z',
    };
    useAppStore.setState({
      notifications: [...store().notifications, projectScoped, sprintScoped],
    });

    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');

    expect(notif('notif-proj-prefix')!.message).toBe(
      'SHOP-900 has been added to the iteration.'
    );
    expect(notif('notif-sprint-prefix')!.message).toBe(
      'ECOMM-761 has been added to the iteration.'
    );
  });
});

describe('R-5: rekey updates iteration names (incl. digit-glued) and issue keys', () => {
  const injectSprints = () => {
    const extra: Sprint[] = [
      { id: 'spr-x', projectId: 'proj-001', name: 'ECOMM3.5' } as unknown as Sprint,
      { id: 'spr-y', projectId: 'proj-001', name: 'ECOMMERCE Cleanup' } as unknown as Sprint,
      { id: 'spr-z', projectId: 'proj-002', name: 'ECOMM cross-project' } as unknown as Sprint,
    ];
    useAppStore.setState({ sprints: [...store().sprints, ...extra] });
  };

  const sprintName = (id: string) => store().sprints.find((s) => s.id === id)!.name;

  it('rekeys sprint names for the rekeyed project, including ECOMM3.5', () => {
    injectSprints();
    const otherProjectSprint = store().sprints.find((s) => s.projectId === 'proj-002')!;
    const otherNameBefore = otherProjectSprint.name;

    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');

    expect(sprintName('spr-008')).toBe('SHOP 4.0');
    expect(sprintName('spr-001')).toBe('SHOP 1.0');
    // The R-5 regression: glued digit versions rekey too.
    expect(sprintName('spr-x')).toBe('SHOP3.5');
    // Longer words that merely start with the prefix stay untouched...
    expect(sprintName('spr-y')).toBe('ECOMMERCE Cleanup');
    // ...as do other projects' sprints.
    expect(sprintName('spr-z')).toBe('ECOMM cross-project');
    expect(sprintName(otherProjectSprint.id)).toBe(otherNameBefore);
  });

  it('re-issues issue keys under the new prefix with the numeric part intact', () => {
    expect(seedTask('task-050').issueKey).toBe('ECOMM-900');
    store().updateProject('proj-001', { key: 'SHOP1.0' }, 'u-admin-01');

    expect(store().tasks.find((t) => t.id === 'task-050')!.issueKey).toBe('SHOP-900');
    expect(store().tasks.find((t) => t.id === 'task-051')!.issueKey).toBe('SHOP-761');
    // Other projects keep their keys.
    const other = store().tasks.find((t) => t.projectId !== 'proj-001' && t.issueKey);
    if (other) expect(other.issueKey).toBe(seedTask(other.id).issueKey);
  });

  it('a rename alone changes neither sprint names nor issue keys', () => {
    injectSprints();
    const beforeSprint = sprintName('spr-008');
    const beforeKey = seedTask('task-050').issueKey;

    store().updateProject('proj-001', { name: 'Shop Platform' }, 'u-admin-01');

    expect(sprintName('spr-008')).toBe(beforeSprint);
    expect(store().tasks.find((t) => t.id === 'task-050')!.issueKey).toBe(beforeKey);
    expect(identityActivities('key')).toHaveLength(0);
  });

  it('leaves every other project fully untouched during a rekey', () => {
    const before = JSON.stringify(
      store().projects.find((p) => p.id === 'proj-002')
    );

    store().updateProject('proj-001', { name: 'Shop Platform', key: 'SHOP1.0' }, 'u-admin-01');

    const after = JSON.stringify(store().projects.find((p) => p.id === 'proj-002'));
    expect(after).toBe(before);
  });
});
