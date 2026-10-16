import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import {
  deriveIssueKeyPrefix,
  normalizeProjectName,
  rekeyIssueKey,
  rekeyPrefixInText,
  replaceProjectNameInText,
  validateProjectName,
} from './projectIdentity';

const project = (id: string, name: string, key = 'K'): Project =>
  ({ id, name, key }) as Project;

describe('deriveIssueKeyPrefix', () => {
  it('strips trailing version segments', () => {
    expect(deriveIssueKeyPrefix('ECOMM4.0')).toBe('ECOMM');
    expect(deriveIssueKeyPrefix('SHOP1.0')).toBe('SHOP');
    expect(deriveIssueKeyPrefix('APP-2.1')).toBe('APP');
  });

  it('keeps a key without a version as-is', () => {
    expect(deriveIssueKeyPrefix('HMS')).toBe('HMS');
  });
});

describe('rekeyIssueKey', () => {
  it('re-issues the prefix and never touches the numeric part', () => {
    expect(rekeyIssueKey('SHOP', 'ECOMM-500')).toBe('SHOP-500');
    expect(rekeyIssueKey('SHOP', 'ECOMM-900')).toBe('SHOP-900');
  });

  it('returns non PREFIX-NUMBER shapes unchanged', () => {
    expect(rekeyIssueKey('SHOP', 'standalone')).toBe('standalone');
    expect(rekeyIssueKey('SHOP', '')).toBe('');
    expect(rekeyIssueKey('', 'ECOMM-500')).toBe('ECOMM-500');
  });
});

describe('normalizeProjectName', () => {
  it('trims and collapses whitespace runs', () => {
    expect(normalizeProjectName('  A   B ')).toBe('A B');
    expect(normalizeProjectName(null)).toBe('');
  });
});

describe('rekeyPrefixInText', () => {
  it('rekeys space-separated iteration names', () => {
    expect(rekeyPrefixInText('ECOMM 4.0', 'ECOMM', 'SHOP')).toBe('SHOP 4.0');
    expect(rekeyPrefixInText('ECOMM 1.0', 'ECOMM', 'SHOP')).toBe('SHOP 1.0');
  });

  it('rekeys digit-glued names such as ECOMM3.5 (the R-5 regression)', () => {
    expect(rekeyPrefixInText('ECOMM3.5', 'ECOMM', 'SHOP')).toBe('SHOP3.5');
    expect(rekeyPrefixInText('ECOMM4.0 hotfix', 'ECOMM', 'SHOP')).toBe('SHOP4.0 hotfix');
  });

  it('rekeys the prefix next to separators, punctuation and end of string', () => {
    expect(rekeyPrefixInText('Release ECOMM-500 notes', 'ECOMM', 'SHOP')).toBe(
      'Release SHOP-500 notes'
    );
    expect(rekeyPrefixInText('See ECOMM', 'ECOMM', 'SHOP')).toBe('See SHOP');
    expect(rekeyPrefixInText('ECOMM, ECOMM', 'ECOMM', 'SHOP')).toBe('SHOP, SHOP');
  });

  it('never touches longer words or keys that merely start with the prefix', () => {
    expect(rekeyPrefixInText('ECOMMERCE backlog', 'ECOMM', 'SHOP')).toBe(
      'ECOMMERCE backlog'
    );
    expect(rekeyPrefixInText('DETAIL view', 'ET', 'X')).toBe('DETAIL view');
    expect(rekeyPrefixInText('AECOMM', 'ECOMM', 'SHOP')).toBe('AECOMM');
  });

  it('is case-insensitive and always writes the uppercased new prefix', () => {
    expect(rekeyPrefixInText('ecomm 4.0', 'ECOMM', 'shop')).toBe('SHOP 4.0');
  });

  it('leaves unrelated prefixes alone and no-ops on empty inputs', () => {
    expect(rekeyPrefixInText('HMS 1.0', 'ECOMM', 'SHOP')).toBe('HMS 1.0');
    expect(rekeyPrefixInText('ECOMM 1.0', 'ECOMM', 'ECOMM')).toBe('ECOMM 1.0');
    expect(rekeyPrefixInText('ECOMM 1.0', '', 'SHOP')).toBe('ECOMM 1.0');
    expect(rekeyPrefixInText('', 'ECOMM', 'SHOP')).toBe('');
  });
});

describe('replaceProjectNameInText', () => {
  it('replaces whole-name occurrences case-insensitively', () => {
    expect(
      replaceProjectNameInText(
        'E-Commerce Platform was assigned to Rahul Kumar.',
        'E-Commerce Platform',
        'Shop Platform'
      )
    ).toBe('Shop Platform was assigned to Rahul Kumar.');
    expect(
      replaceProjectNameInText('rollout of e-commerce platform', 'E-Commerce Platform', 'Shop Platform')
    ).toBe('rollout of Shop Platform');
  });

  it('never matches inside longer words (short names stay safe)', () => {
    expect(replaceProjectNameInText('Workshop tools', 'Shop', 'Store')).toBe(
      'Workshop tools'
    );
    expect(replaceProjectNameInText('assigned items', 'A', 'B')).toBe('assigned items');
  });

  it('no-ops on empty or identical inputs', () => {
    expect(replaceProjectNameInText('E-Commerce Platform', '', 'X')).toBe(
      'E-Commerce Platform'
    );
    expect(replaceProjectNameInText('E-Commerce Platform', 'E-Commerce Platform', 'E-Commerce Platform')).toBe(
      'E-Commerce Platform'
    );
  });
});

describe('validateProjectName', () => {
  const projects = [
    project('proj-001', 'E-Commerce Platform'),
    project('proj-002', 'Hospital Management System'),
  ];

  it('rejects empty and whitespace-only names', () => {
    expect(validateProjectName('', projects).ok).toBe(false);
    expect(validateProjectName('   ', projects).ok).toBe(false);
    expect(validateProjectName('', projects).error).toBe('Project Name is required');
  });

  it('rejects exact duplicates', () => {
    const result = validateProjectName('E-Commerce Platform', projects);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already used');
  });

  it('rejects case-insensitive and whitespace-normalized duplicates', () => {
    expect(validateProjectName('e-commerce platform', projects).ok).toBe(false);
    expect(validateProjectName('  Hospital   Management  System ', projects).ok).toBe(false);
  });

  it("keeps a project's own unchanged name valid when excluded", () => {
    expect(validateProjectName('E-Commerce Platform', projects, 'proj-001').ok).toBe(true);
    expect(validateProjectName('e-commerce platform', projects, 'proj-001').ok).toBe(true);
  });

  it('accepts a genuinely new name', () => {
    expect(validateProjectName('Shop Platform', projects).ok).toBe(true);
  });
});
