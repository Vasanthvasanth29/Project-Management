import type { Project } from '../types';

/**
 * Centralized project identity model — the ONE place that derives identity
 * strings from a project's key. Every surface (issue keys, iteration ids,
 * board rows, breadcrumbs, search, modals) must go through these helpers so a
 * rename/rekey immediately updates every reference and nothing hardcodes a
 * prefix:
 *
 *   Project Key   "WEBCORM4.0"   user-editable, unique across the org
 *   Issue Prefix  "WEBCORM"      derived from the key (version stripped)
 *   Issue Key     "WEBCORM-500"  prefix + "-" + number (number never changes)
 *   Iteration ID  "WEBCORM4.1"   prefix + PI + "." + sequence
 *
 * The project's `id` (e.g. "proj-001") is immutable and is NEVER derived from
 * the key — URLs still match by id after any rename.
 */
export interface ProjectIdentityInput {
  key?: string | null;
  /** Optional explicit override; when absent the prefix is derived from `key`. */
  issueKeyPrefix?: string | null;
}

/** Uppercased key or '' when the project has no key yet. */
export const getProjectKey = (
  project: ProjectIdentityInput | null | undefined
): string => (project?.key || '').trim().toUpperCase();

/**
 * Derives the issue-key prefix from a project key by stripping a trailing
 * version/PI segment:
 *   "WEBCORM4.0" -> "WEBCORM", "ECOMM4.0" -> "ECOMM", "ECOMM" -> "ECOMM",
 *   "APP-2.1" -> "APP", "ANALYTICS1.0" -> "ANALYTICS".
 */
export function deriveIssueKeyPrefix(rawKey: string | null | undefined): string {
  const key = (rawKey || '').trim().toUpperCase();
  if (!key) return '';
  const withoutVersion = key
    .replace(/[\s._-]*\d+(?:\.\d+)*$/, '')
    .replace(/[\s._-]+$/, '');
  const candidate = withoutVersion.replace(/[^A-Z0-9]/g, '');
  // A key that is nothing but a version/number keeps its raw alphanumeric form.
  return candidate || key.replace(/[^A-Z0-9]/g, '');
}

/** The issue-key prefix for a project: explicit override when stored, else derived. */
export function getIssueKeyPrefix(
  project: ProjectIdentityInput | null | undefined
): string {
  if (!project) return '';
  const explicit = (project.issueKeyPrefix || '').trim().toUpperCase();
  if (explicit) return explicit;
  return deriveIssueKeyPrefix(project.key);
}

/** Builds a canonical issue key: "WEBCORM" + 500 -> "WEBCORM-500". */
export function buildIssueKey(
  prefix: string | null | undefined,
  number: string | number
): string {
  const p = (prefix || '').trim().toUpperCase();
  const n = String(number);
  if (!p) return n;
  return `${p}-${n}`;
}

/**
 * Re-issues a stored issue key under the project's CURRENT prefix while the
 * numeric part stays untouched ("ECOMM-500" -> "WEBCORM-500" after a rekey).
 * Keys that are not of the `PREFIX-NUMBER` shape are returned unchanged.
 */
export function rekeyIssueKey(
  prefix: string | null | undefined,
  storedKey: string | null | undefined
): string {
  const key = (storedKey || '').trim();
  if (!key) return key;
  const p = (prefix || '').trim().toUpperCase();
  if (!p) return key;
  const dash = key.lastIndexOf('-');
  if (dash <= 0) return key;
  const suffix = key.slice(dash + 1);
  if (!/^[A-Z0-9]+$/i.test(suffix)) return key;
  return `${p}-${suffix.toUpperCase()}`;
}

/** Allowed shape: starts with a letter, optional trailing version ("4.0", "-2"). */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]*(?:[.\-]\d+)*$/;

export const PROJECT_KEY_MAX_LENGTH = 14;

/** Normalizes typed key input: uppercase, allowed characters only, length capped. */
export function sanitizeProjectKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, '')
    .slice(0, PROJECT_KEY_MAX_LENGTH);
}

/** Escapes a literal string for safe use inside a RegExp. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normalizes a project name for comparison/storage: trimmed with internal
 * whitespace runs collapsed to a single space ("  A   B " -> "A B").
 */
export function normalizeProjectName(raw: string | null | undefined): string {
  return (raw || '').trim().replace(/\s+/g, ' ');
}

/**
 * Re-issues `oldPrefix` tokens in free text after a project rekey
 * (`ECOMM 4.0` -> `SHOP 4.0`, `ECOMM3.5` -> `SHOP3.5`).
 *
 * A token must START at a boundary (string start or a non-alphanumeric
 * character) and must NOT be followed by a letter. Everything else — end of
 * string, separator, punctuation, or a digit-led version segment — counts as
 * the end of the prefix. That covers prefixes glued to digits (`ECOMM3.5`)
 * while leaving longer words and keys alone (`ECOMMERCE` under `ECOMM`,
 * `DETAIL` under `ET`). Matching is case-insensitive; the replacement is the
 * uppercased `newPrefix`.
 */
export function rekeyPrefixInText(
  text: string,
  oldPrefix: string | null | undefined,
  newPrefix: string | null | undefined
): string {
  const oldP = (oldPrefix || '').trim().toUpperCase();
  const newP = (newPrefix || '').trim().toUpperCase();
  if (!text || !oldP || !newP || oldP === newP) return text;
  const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(oldP)}(?![A-Za-z])`, 'gi');
  return text.replace(re, (_match, lead: string) => `${lead}${newP}`);
}

/**
 * Replaces whole occurrences of a project name in free text with the new
 * name. Matches are case-insensitive and must sit on token boundaries (no
 * match inside longer words: `Shop` never touches `Workshop`, short names
 * like `A` never touch `assigned`), so overlapping/short names cannot corrupt
 * unrelated text.
 */
export function replaceProjectNameInText(
  text: string,
  fromName: string | null | undefined,
  toName: string | null | undefined
): string {
  const find = normalizeProjectName(fromName);
  const replace = normalizeProjectName(toName);
  if (!text || !find || !replace || find === replace) return text;
  const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(find)}(?![A-Za-z0-9])`, 'gi');
  return text.replace(re, (_match, lead: string) => `${lead}${replace}`);
}

export interface ProjectNameValidation {
  ok: boolean;
  /** Human-readable validation message (present when !ok). */
  error?: string;
}

/**
 * Validates a project name against every other project: non-empty after
 * whitespace normalization and unique case-insensitively. `excludeProjectId`
 * keeps an edited project's own (unchanged) name valid.
 */
export function validateProjectName(
  rawName: string,
  projects: Project[],
  excludeProjectId?: string
): ProjectNameValidation {
  const name = normalizeProjectName(rawName);
  if (!name) return { ok: false, error: 'Project Name is required' };
  const lower = name.toLowerCase();
  const duplicate = projects
    .filter((p) => p.id !== excludeProjectId)
    .find((p) => normalizeProjectName(p.name).toLowerCase() === lower);
  if (duplicate) {
    return { ok: false, error: `Project Name "${name}" is already used by ${duplicate.name}` };
  }
  return { ok: true };
}

export interface ProjectKeyValidation {
  ok: boolean;
  /** Derived issue prefix (present when `ok`). */
  prefix?: string;
  /** Human-readable validation message (present when !ok). */
  error?: string;
}

/**
 * Validates an edited/created project key against the identity rules:
 * non-empty, allowed format, unique key AND unique derived issue prefix
 * (two projects must never share `PREFIX-NUMBER` space).
 */
export function validateProjectKey(
  rawKey: string,
  projects: Project[],
  excludeProjectId?: string
): ProjectKeyValidation {
  const key = (rawKey || '').trim().toUpperCase();
  if (!key) return { ok: false, error: 'Project Key is required' };
  if (key.length < 2 || key.length > PROJECT_KEY_MAX_LENGTH) {
    return {
      ok: false,
      error: `Project Key must be 2-${PROJECT_KEY_MAX_LENGTH} characters`,
    };
  }
  if (!PROJECT_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error: 'Project Key must start with a letter and use letters, numbers and an optional version (e.g. WEBCORM4.0)',
    };
  }

  const others = projects.filter((p) => p.id !== excludeProjectId);

  const duplicateKey = others.find((p) => getProjectKey(p) === key);
  if (duplicateKey) {
    return { ok: false, error: `Project Key "${key}" is already used by ${duplicateKey.name}` };
  }

  const prefix = deriveIssueKeyPrefix(key);
  if (!prefix) return { ok: false, error: 'Could not derive an issue prefix from this key' };

  const duplicatePrefix = others.find(
    (p) => getIssueKeyPrefix(p) === prefix
  );
  if (duplicatePrefix) {
    return {
      ok: false,
      error: `Issue prefix "${prefix}" is already used by ${duplicatePrefix.name} — issue keys would collide`,
    };
  }

  return { ok: true, prefix };
}
