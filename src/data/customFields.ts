import type { CustomFieldDefinition } from '../types';

/**
 * Legacy demo fields (Client Name, Business Priority, Environment, Target
 * Release, Customer Impact, QA Owner) that used to be pre-seeded onto every
 * demo-project issue. They are no longer shipped: the Details section starts
 * with core fields only, and custom fields exist solely when an Admin/PM adds
 * them via "Add Field" on a specific issue. These ids are kept so persisted
 * snapshots written before this change can drop them during hydration
 * (see utils/customFieldPersistence).
 */
export const LEGACY_SEED_CUSTOM_FIELD_IDS: string[] = [
  'cf-seed-client-name',
  'cf-seed-business-priority',
  'cf-seed-environment',
  'cf-seed-target-release',
  'cf-seed-customer-impact',
  'cf-seed-qa-owner',
];

export const isLegacySeedCustomFieldId = (id: string): boolean =>
  LEGACY_SEED_CUSTOM_FIELD_IDS.includes(id);

/** No demo definitions — custom fields are issue-specific and user-created. */
export const SEED_CUSTOM_FIELD_DEFINITIONS: CustomFieldDefinition[] = [];
