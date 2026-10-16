import type {
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldValue,
  Task,
  WorkItemType,
} from '../types';

/** Display labels for every supported custom field type. */
export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  text: 'Text',
  long_text: 'Long Text',
  number: 'Number',
  decimal: 'Decimal',
  date: 'Date',
  datetime: 'Date & Time',
  dropdown: 'Dropdown',
  multi_select: 'Multi Select',
  checkbox: 'Checkbox',
  url: 'URL',
  user: 'User',
  email: 'Email',
};

export const CUSTOM_FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABEL) as CustomFieldType[];

/** Issue types selectable when configuring a field's applicability. */
export const WORK_ITEM_TYPES: WorkItemType[] = [
  'INITIATIVE',
  'FEATURE',
  'EPIC',
  'STORY',
  'TASK',
  'SUB-TASK',
  'BUG_FIX',
  'IMPROVEMENT',
];

export const WORK_ITEM_TYPE_LABEL: Record<WorkItemType, string> = {
  INITIATIVE: 'Initiative',
  FEATURE: 'Feature',
  EPIC: 'Epic',
  STORY: 'Story',
  TASK: 'Task',
  'SUB-TASK': 'Sub-task',
  BUG_FIX: 'Bug',
  IMPROVEMENT: 'Improvement',
};

/** Header label shown on the issue: falls back to the machine name. */
export const fieldLabel = (field: CustomFieldDefinition): string =>
  field.label && field.label.trim() !== '' ? field.label : field.name;

/** Dropdown and Multi Select are the only types that carry an options list. */
export const customFieldTypeUsesOptions = (type: CustomFieldType): boolean =>
  type === 'dropdown' || type === 'multi_select';

/** Types that can carry a default value in the configuration form. */
export const customFieldTypeSupportsDefault = (type: CustomFieldType): boolean =>
  type !== 'multi_select';

/** A value counts as empty for required-validation purposes. */
export const isCustomValueEmpty = (
  field: Pick<CustomFieldDefinition, 'type'>,
  value: CustomFieldValue | undefined
): boolean => {
  if (field.type === 'checkbox') return value !== true;
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validation for a batch of custom field values:
 *  - enabled required fields must hold a non-empty value
 *  - number/decimal must be numeric, email/URL must be well-formed
 * Returns user-facing messages ("Client Name is required.") in field order.
 * Disabled fields are never validated.
 */
export const validateCustomFieldValues = (
  fields: CustomFieldDefinition[],
  values: Record<string, CustomFieldValue | undefined>
): string[] => {
  const errors: string[] = [];
  fields.forEach((field) => {
    if (!field.enabled) return;
    const label = fieldLabel(field);
    const value = values[field.id];
    if (field.required && isCustomValueEmpty(field, value)) {
      errors.push(`${label} is required.`);
      return;
    }
    if (isCustomValueEmpty(field, value)) return;
    const raw = String(value);
    if ((field.type === 'number' || field.type === 'decimal') && (raw.trim() === '' || isNaN(Number(raw)))) {
      errors.push(`${label} must be a number.`);
    } else if (field.type === 'email' && !EMAIL_RE.test(raw.trim())) {
      errors.push(`${label} must be a valid email address.`);
    } else if (field.type === 'url') {
      try {
        const url = new URL(raw.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
      } catch {
        errors.push(`${label} must be a valid URL.`);
      }
    }
  });
  return errors;
};

/** True when an issue stores a value key for a custom field (present even if
 * the value itself is empty — the key is what binds a created field to the
 * issue it was created on). */
export const hasCustomFieldValue = (
  task: Pick<Task, 'customFieldValues'>,
  field: CustomFieldDefinition
): boolean =>
  !!task.customFieldValues &&
  Object.prototype.hasOwnProperty.call(task.customFieldValues, field.id);

/**
 * Custom fields that belong to THIS issue: configured for its project and
 * applicable to its type, AND bound to it by a stored value key. Fields are
 * issue-specific — a field created on one issue never appears on siblings.
 */
export const getIssueCustomFields = (
  definitions: CustomFieldDefinition[],
  task: Pick<Task, 'projectId' | 'type' | 'customFieldValues'>
): CustomFieldDefinition[] =>
  definitions.filter(
    (d) =>
      d.projectId === task.projectId &&
      ((d.applicableIssueTypes ?? []).length === 0 ||
        (d.applicableIssueTypes ?? []).includes(task.type)) &&
      hasCustomFieldValue(task, d)
  );

/** Initial/empty draft value for a field (used when creating edit drafts). */
export const customFieldValueForDraft = (field: CustomFieldDefinition): CustomFieldValue => {
  if (field.type === 'multi_select') return [];
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'checkbox') return false;
  return '';
};

/**
 * Value to show for a field on an issue: a stored value wins whenever the key
 * exists (so a user-cleared value stays cleared instead of snapping back to
 * the default); otherwise the configured default applies.
 */
export const effectiveCustomFieldValue = (
  field: CustomFieldDefinition,
  stored: Record<string, CustomFieldValue | undefined>
): CustomFieldValue | undefined =>
  field.id in stored ? stored[field.id] : field.defaultValue;
