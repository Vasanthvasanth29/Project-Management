import type { TaskStatus } from '../types';

/**
 * JQL-style query support for the Issue Search page (frontend-only subset).
 *
 * Grammar (case-insensitive keywords):
 *   query    := [ conditions ] [ ORDER BY field [ASC|DESC] ]
 *   conditions := group ( OR group )*
 *   group    := clause ( AND clause )*
 *   clause   := field op value
 *   op       := = | != | < | <= | > | >= | is | is not | in | not in
 *   value    := "multi word value" | singleToken | ( v1, v2, ... )   [in / not in]
 *
 * Supported fields: sprint, project, assignee, status, priority, type, key, updated.
 * `updated` uses date comparison operators and date functions (e.g. startOfDay()).
 * `is` is an alias for `=`, `is not` for `!=`. A missing closing `)` is tolerated
 * only when the list runs to the end of the query.
 */

export const QUERY_FIELDS = ['sprint', 'project', 'assignee', 'status', 'priority', 'type', 'key', 'updated'] as const;
export type QueryField = (typeof QUERY_FIELDS)[number];

export type QueryOperator = '=' | '!=' | 'in' | 'not in' | '<' | '<=' | '>' | '>=';

/** Operators accepted by each field (parsing). Aliases is/is not map to =/!=. */
const OPERATORS_BY_FIELD: Record<QueryField, readonly QueryOperator[]> = {
  sprint: ['=', '!=', 'in', 'not in'],
  project: ['=', '!=', 'in', 'not in'],
  assignee: ['=', '!=', 'in', 'not in'],
  status: ['=', '!=', 'in', 'not in'],
  priority: ['=', '!=', 'in', 'not in'],
  type: ['=', '!=', 'in', 'not in'],
  key: ['=', '!=', 'in', 'not in'],
  updated: ['=', '!=', '<', '<=', '>', '>='],
};

/** Operator rows offered by autocomplete (aliases included for text fields). */
const SUGGESTED_OPERATORS: Record<QueryField, readonly string[]> = {
  sprint: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  project: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  assignee: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  status: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  priority: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  type: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  key: ['=', '!=', 'is', 'is not', 'in', 'not in'],
  updated: ['=', '!=', '<', '<=', '>', '>='],
};

export const OPERATOR_HINTS: Record<string, string> = {
  '=': 'Equals',
  '!=': 'Does not equal',
  is: 'Matches exactly',
  'is not': 'Does not match',
  in: 'Any of the listed values',
  'not in': 'None of the listed values',
  '<': 'Before',
  '<=': 'On or before',
  '>': 'After',
  '>=': 'On or after',
};

export const operatorsFor = (field: QueryField): string[] => [...SUGGESTED_OPERATORS[field]];

export const LOGICAL_SUGGESTIONS: SuggestionItem[] = [
  { label: 'AND', value: 'AND', hint: 'All of these conditions' },
  { label: 'OR', value: 'OR', hint: 'Any of these conditions' },
  { label: 'ORDER BY', value: 'ORDER BY', hint: 'Sort the results' },
];

export const ORDER_BY_FIELDS = ['type', 'key', 'summary', 'assignee', 'updated', 'sprint', 'points'] as const;
export type OrderByField = (typeof ORDER_BY_FIELDS)[number];

export const ORDER_BY_FIELD_HINTS: Record<string, string> = {
  type: 'Issue type',
  key: 'Issue key',
  summary: 'Summary text',
  assignee: 'Assignee name',
  updated: 'Last updated date',
  sprint: 'Iteration',
  points: 'Story points',
};

export const DATE_FUNCTIONS = [
  'now()', 'startOfDay()', 'endOfDay()',
  'startOfWeek()', 'endOfWeek()',
  'startOfMonth()', 'endOfMonth()',
  'startOfYear()', 'endOfYear()',
] as const;

export const DATE_FUNCTION_HINTS: Record<string, string> = {
  'now()': 'Current date',
  'startOfDay()': 'Start of today',
  'endOfDay()': 'End of today',
  'startOfWeek()': 'Start of this week (Mon)',
  'endOfWeek()': 'End of this week (Sun)',
  'startOfMonth()': 'First day of this month',
  'endOfMonth()': 'Last day of this month',
  'startOfYear()': 'First day of this year',
  'endOfYear()': 'Last day of this year',
};

export interface ParsedClause {
  field: QueryField;
  op: QueryOperator;
  values: string[];
}

export interface ParsedQuery {
  /** OR of AND-groups: a row matches when any group matches entirely. */
  groups: ParsedClause[][];
  orderBy?: { field: OrderByField; dir: 'asc' | 'desc' };
}

export type ParseResult = { ok: true; query: ParsedQuery } | { ok: false };

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  TESTING: 'Testing',
  BUG_FIX: 'Bug Fix',
  RETEST: 'Retest',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
  BACKLOG: 'Backlog',
  ASSESSMENT: 'Assessment',
  ON_BOARD: 'On Board',
  READY_FOR_DEVELOPMENT: 'Ready for Development',
  IN_DEVELOPMENT: 'In Development',
  ON_HOLD: 'On Hold',
  DEVELOPMENT_COMPLETE: 'Development Complete',
  READY_FOR_DEPLOYMENT: 'Ready for Deployment',
  DEPLOYMENT: 'Deployment',
  VALIDATION: 'Validation',
  COMPLETED: 'Completed',
};

export const PRIORITY_LABELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const ISSUE_TYPE_LABELS = ['Story', 'Task', 'Bug', 'Epic'] as const;

/** Normalizes for forgiving comparisons: "In Progress" === "in_progress" === "IN PROGRESS". */
export const normalizeValue = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const pad2 = (n: number): string => String(n).padStart(2, '0');

const toISODate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Resolves a date literal or date function to YYYY-MM-DD, or null when unparseable. */
export function resolveDateValue(raw: string): string | null {
  const v = raw.trim().replace(/^["']|["']$/g, '');
  const lower = v.toLowerCase();
  const now = new Date();
  switch (lower) {
    case 'now()':
    case 'now':
    case 'startofday()':
    case 'endofday()':
      return toISODate(now);
    case 'startofweek()': {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return toISODate(d);
    }
    case 'endofweek()': {
      const d = new Date(now);
      d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
      return toISODate(d);
    }
    case 'startofmonth()':
      return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    case 'endofmonth()':
      return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    case 'startofyear()':
      return toISODate(new Date(now.getFullYear(), 0, 1));
    case 'endofyear()':
      return toISODate(new Date(now.getFullYear(), 11, 31));
    default:
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
}

const isDateFieldValue = (value: string): boolean => resolveDateValue(value) !== null;

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const isQueryField = (name: string): name is QueryField =>
  (QUERY_FIELDS as readonly string[]).includes(name);

const isOperatorFor = (field: QueryField, op: QueryOperator): boolean =>
  OPERATORS_BY_FIELD[field].includes(op);

/** Splits text on a top-level keyword (AND/OR) outside quotes and parens. */
const splitTopLevel = (text: string, keyword: 'AND' | 'OR'): string[] | null => {
  const parts: string[] = [];
  let quote: string | null = null;
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z]/.test(text[j])) j += 1;
      const word = text.slice(i, j);
      const after = text[j];
      const boundaryAfter = after === undefined || /[^A-Za-z]/.test(after);
      if (word.toUpperCase() === keyword && boundaryAfter) {
        parts.push(text.slice(start, i));
        start = j;
      }
      i = j;
      continue;
    }
    i += 1;
  }
  if (quote) return null; // unterminated quote
  parts.push(text.slice(start));
  return parts;
};

const parseQuotedOrToken = (raw: string): string | null => {
  const text = raw;
  if (!text) return null;
  const q = text[0];
  if (q === '"' || q === "'") {
    const close = text.indexOf(q, 1);
    if (close < 0) return null;
    if (text.slice(close + 1).trim() !== '') return null;
    const value = text.slice(1, close);
    return value ? value : null;
  }
  if (/[\s"']/.test(text)) return null; // multi-word values must be quoted
  return text;
};

const splitListItems = (content: string): string[] | null => {
  const items: string[] = [];
  let quote: string | null = null;
  let current = '';
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (quote) return null;
  items.push(current);
  return items;
};

const parseClause = (rawText: string): ParsedClause | null => {
  const text = rawText.trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z]+)\s*(not\s+in|is\s+not|not\s+is|in|is|=|!=|<=|>=|<|>)\s*([\s\S]*)$/i);
  if (!match) return null;

  const field = match[1].toLowerCase();
  if (!isQueryField(field)) return null;

  let op = match[2].toLowerCase().replace(/\s+/g, ' ');
  if (op === 'is') op = '=';
  else if (op === 'is not' || op === 'not is') op = '!=';
  if (!isOperatorFor(field, op as QueryOperator)) return null;
  const operator = op as QueryOperator;

  const valuePart = match[3].trim();

  if (operator === 'in' || operator === 'not in') {
    if (!valuePart.startsWith('(')) return null;
    let quote: string | null = null;
    let depth = 1;
    let close = -1;
    for (let i = 1; i < valuePart.length; i += 1) {
      const ch = valuePart[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    const content = close >= 0 ? valuePart.slice(1, close) : valuePart.slice(1);
    if (close >= 0 && valuePart.slice(close + 1).trim() !== '') return null;
    const parts = splitListItems(content);
    if (!parts || parts.length === 0) return null;
    const values: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const item = parts[i].trim();
      if (!item) {
        // A trailing comma (…) is tolerated so `in ("a", ` stays searchable.
        if (i === parts.length - 1) continue;
        return null;
      }
      const value = parseQuotedOrToken(item);
      if (value === null) return null;
      values.push(value);
    }
    if (values.length === 0) return null;
    return { field, op: operator, values };
  }

  if (!valuePart) return null;
  const value = parseQuotedOrToken(valuePart);
  if (value === null) return null;
  if (field === 'updated' && !isDateFieldValue(value)) return null;
  return { field, op: operator, values: [value] };
};

/** Finds the first top-level `ORDER BY` keyword; returns index of `ORDER` or -1. */
const findOrderByIndex = (text: string): number => {
  let quote: string | null = null;
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z]/.test(text[j])) j += 1;
      if (text.slice(i, j).toLowerCase() === 'order') {
        let k = j;
        while (k < text.length && /\s/.test(text[k])) k += 1;
        let m = k;
        while (m < text.length && /[A-Za-z]/.test(text[m])) m += 1;
        if (m > k && text.slice(k, m).toLowerCase() === 'by') return i;
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return -1;
};

const parseOrderBy = (raw: string): { field: OrderByField; dir: 'asc' | 'desc' } | null => {
  const match = raw.trim().match(/^([A-Za-z]+)(?:\s+(asc|desc))?$/i);
  if (!match) return null;
  const field = match[1].toLowerCase();
  if (!(ORDER_BY_FIELDS as readonly string[]).includes(field)) return null;
  const dir = (match[2] ? match[2].toLowerCase() : 'asc') as 'asc' | 'desc';
  return { field: field as OrderByField, dir };
};

/** Parses the supported query subset. Returns { ok: false } for anything unparseable. */
export function parseIssueQuery(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: true, query: { groups: [] } };

  const orderByIdx = findOrderByIndex(text);
  const conditions = (orderByIdx >= 0 ? text.slice(0, orderByIdx) : text).trim();
  let orderBy: { field: OrderByField; dir: 'asc' | 'desc' } | undefined;
  if (orderByIdx >= 0) {
    const byMatch = /\border\s+by\b/i.exec(text.slice(orderByIdx));
    if (!byMatch) return { ok: false };
    const parsedOrder = parseOrderBy(text.slice(orderByIdx + byMatch.index + byMatch[0].length));
    if (!parsedOrder) return { ok: false };
    orderBy = parsedOrder;
  }

  const groups: ParsedClause[][] = [];
  if (conditions) {
    const orParts = splitTopLevel(conditions, 'OR');
    if (!orParts) return { ok: false };
    for (const orPart of orParts) {
      const andParts = splitTopLevel(orPart, 'AND');
      if (!andParts) return { ok: false };
      const clauses: ParsedClause[] = [];
      for (const part of andParts) {
        const clause = parseClause(part);
        if (!clause) return { ok: false };
        clauses.push(clause);
      }
      if (clauses.length === 0) return { ok: false };
      groups.push(clauses);
    }
  }

  return { ok: true, query: { groups, ...(orderBy ? { orderBy } : {}) } };
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

/** The searchable facets of one issue row. */
export interface IssueQueryFields {
  sprint: string[];
  project: string[];
  assignee: string;
  status: string;
  priority: string;
  type: string;
  key: string;
  /** Last-updated date of the issue as YYYY-MM-DD. */
  updated: string;
}

const textMatches = (field: QueryField, fields: IssueQueryFields, wanted: string): boolean => {
  switch (field) {
    case 'sprint':
      return fields.sprint.some((candidate) => normalizeValue(candidate) === wanted);
    case 'project':
      return fields.project.some((candidate) => normalizeValue(candidate) === wanted);
    case 'assignee':
      return normalizeValue(fields.assignee).includes(wanted);
    case 'status':
      return normalizeValue(fields.status) === wanted;
    case 'priority':
      return normalizeValue(fields.priority) === wanted;
    case 'type':
      return (
        normalizeValue(fields.type) === wanted ||
        (wanted === 'bugfix' && normalizeValue(fields.type) === 'bug')
      );
    case 'key':
      return normalizeValue(fields.key) === wanted;
    default:
      return false;
  }
};

const matchesClause = (clause: ParsedClause, fields: IssueQueryFields): boolean => {
  const { field, op, values } = clause;

  if (field === 'updated') {
    const want = resolveDateValue(values[0]);
    if (!want) return false;
    const have = fields.updated;
    if (!have) return false;
    switch (op) {
      case '=': return have === want;
      case '!=': return have !== want;
      case '<': return have < want;
      case '<=': return have <= want;
      case '>': return have > want;
      case '>=': return have >= want;
      default: return false;
    }
  }

  const matchesAny = values.some((value) => textMatches(field, fields, normalizeValue(value)));
  switch (op) {
    case '=': return matchesAny;
    case '!=': return !matchesAny;
    case 'in': return matchesAny;
    case 'not in': return !matchesAny;
    default: return false;
  }
};

/**
 * Applies a parsed query to one issue: OR between groups, AND within a group.
 * An empty query (no conditions) matches everything.
 */
export function matchesIssueQuery(query: ParsedQuery, fields: IssueQueryFields): boolean {
  if (query.groups.length === 0) return true;
  return query.groups.some((group) => group.every((clause) => matchesClause(clause, fields)));
}

/** Flattens every clause (ignoring group structure) — used for context lookups. */
export const flattenClauses = (query: ParsedQuery): ParsedClause[] =>
  query.groups.flat();

/* ------------------------------------------------------------------ */
/* Autocomplete                                                        */
/* ------------------------------------------------------------------ */

export interface SuggestionItem {
  label: string;
  value: string;
  hint?: string;
}

export type SuggestionContext =
  | { kind: 'field'; start: number; end: number; typed: string }
  | { kind: 'operator'; field: QueryField; start: number; end: number; typed: string }
  | {
      kind: 'value';
      field: QueryField;
      op: QueryOperator;
      start: number;
      end: number;
      typed: string;
      quoted: boolean;
      inList: boolean;
      parenOpen: boolean;
      listHasValues: boolean;
    }
  | { kind: 'logical'; start: number; end: number; typed: string }
  | { kind: 'orderField'; start: number; end: number; typed: string }
  | { kind: 'orderDir'; start: number; end: number; typed: string };

const OP_PATTERN = 'not\\s+in|is\\s+not|not\\s+is|in|is|=|!=|<=|>=|<|>';
const SCALAR_OP_PATTERN = 'is\\s+not|not\\s+is|is|=|!=|<=|>=|<|>';

const normalizeOpToken = (raw: string): string => {
  let op = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (op === 'is') op = '=';
  else if (op === 'is not' || op === 'not is') op = '!=';
  return op;
};

interface TailScan {
  /** Index right after the last committed event (value terminator / connector). */
  splitIdx: number;
  reason: 'value' | 'connector' | 'start';
}

/**
 * Finds where the current editing segment starts: after the last depth-0 value
 * terminator (`"`/`'`/`)`) or after the last committed AND/OR connector.
 * Connectors only commit when followed by whitespace (per spec: `... AND` at the
 * end of the query is not yet committed).
 */
const scanTail = (before: string): TailScan => {
  let quote: string | null = null;
  let depth = 0;
  let splitIdx = 0;
  let reason: TailScan['reason'] = 'start';
  let i = 0;
  while (i < before.length) {
    const ch = before[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
        if (depth === 0) {
          splitIdx = i + 1;
          reason = 'value';
        }
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        splitIdx = i + 1;
        reason = 'value';
      }
      i += 1;
      continue;
    }
    if (depth === 0 && /[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < before.length && /[A-Za-z]/.test(before[j])) j += 1;
      const word = before.slice(i, j);
      const upper = word.toUpperCase();
      const followedBySpace = before[j] === ' ' || before[j] === '\t';
      if ((upper === 'AND' || upper === 'OR') && followedBySpace) {
        splitIdx = j;
        reason = 'connector';
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return { splitIdx, reason };
};

const countChar = (text: string, ch: string): number => {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) if (text[i] === ch) n += 1;
  return n;
};

/**
 * Describes what the caret is currently typing and which region it replaces.
 * Checks run in spec order: ORDER BY → quoted value → in-list → unquoted value
 * → logical connector → operator → field.
 */
export function getSuggestionContext(value: string, caret: number): SuggestionContext | null {
  const before = value.slice(0, caret);
  const { splitIdx, reason } = scanTail(before);
  const segment = before.slice(splitIdx);

  // ORDER BY direction:  ... ORDER BY key as|
  const orderDir = segment.match(/^\s*order\s+by\s+[A-Za-z]+\s+([A-Za-z]*)$/i);
  if (orderDir) {
    const typed = orderDir[1];
    return { kind: 'orderDir', start: caret - typed.length, end: caret, typed };
  }

  // ORDER BY field:  ... ORDER BY ke|
  const orderField = segment.match(/^\s*order\s+by\s*([A-Za-z]*)$/i);
  if (orderField) {
    const typed = orderField[1];
    return { kind: 'orderField', start: caret - typed.length, end: caret, typed };
  }

  // A new clause may only start after a connector — with `reason === 'value'` the
  // caret sits right after a finished value, so connectors come first (below).
  if (reason === 'value') {
    // Logical connector after a finished value:  sprint = "X" an|
    if (/^[\sA-Za-z]*$/.test(segment)) {
      return { kind: 'logical', start: splitIdx, end: caret, typed: segment.trim() };
    }
    return null;
  }

  // Open quoted value:  status = "Do|   (also `updated >= "2026`)
  const quoted = segment.match(new RegExp(`([A-Za-z]+)\\s*(${OP_PATTERN})\\s*"([^"]*)$`));
  if (quoted && isQueryField(quoted[1].toLowerCase())) {
    const typed = quoted[3];
    const field = quoted[1].toLowerCase() as QueryField;
    const op = normalizeOpToken(quoted[2]);
    if (isOperatorFor(field, op as QueryOperator)) {
      const start = caret - typed.length - 1; // include the opening quote
      return {
        kind: 'value', field, op: op as QueryOperator,
        start, end: caret, typed, quoted: true,
        inList: op === 'in' || op === 'not in', parenOpen: false, listHasValues: false,
      };
    }
  }

  // In-list:  status in ("Done", "To|
  const inList = segment.match(new RegExp(`^\\s*([A-Za-z]+)\\s+(not\\s+in|in)\\s*\\(([^)]*)$`, 'i'));
  if (inList && isQueryField(inList[1].toLowerCase())) {
    const field = inList[1].toLowerCase() as QueryField;
    const op = normalizeOpToken(inList[2]) as QueryOperator;
    if (isOperatorFor(field, op)) {
      const content = inList[3];
      const lastQuote = Math.max(content.lastIndexOf('"'), content.lastIndexOf("'"));
      const quotesSoFar = countChar(content, '"') + countChar(content, "'");
      const lastComma = content.lastIndexOf(',');
      const contentStart = splitIdx + segment.indexOf('(') + 1;
      if (lastQuote >= 0 && quotesSoFar % 2 === 1) {
        const typed = content.slice(lastQuote + 1);
        const start = contentStart + lastQuote;
        return {
          kind: 'value', field, op, start, end: caret, typed, quoted: true,
          inList: true, parenOpen: true, listHasValues: lastComma >= 0,
        };
      }
      const tail = content.slice(lastComma + 1);
      const typed = tail.trim().replace(/^["']|["']$/g, '');
      if (lastComma >= 0 || tail.trim() !== '') {
        const start = contentStart + lastComma + 1 + (tail.length - tail.trimStart().length);
        return {
          kind: 'value', field, op, start, end: caret, typed, quoted: false,
          inList: true, parenOpen: true, listHasValues: lastComma >= 0,
        };
      }
      return {
        kind: 'value', field, op, start: caret, end: caret, typed: '', quoted: false,
        inList: true, parenOpen: true,
        listHasValues: content.replace(/,\s*$/, '').trim() !== '',
      };
    }
  }

  // Unquoted value:  status = Do|   /   updated >= startOfDay|
  const unquoted = segment.match(new RegExp(`([A-Za-z]+)\\s*(${SCALAR_OP_PATTERN})\\s*([^\\s"']*)$`));
  if (unquoted && isQueryField(unquoted[1].toLowerCase())) {
    const field = unquoted[1].toLowerCase() as QueryField;
    const op = normalizeOpToken(unquoted[2]) as QueryOperator;
    if (isOperatorFor(field, op)) {
      const typed = unquoted[3];
      const start = caret - typed.length;
      return {
        kind: 'value', field, op, start, end: caret, typed, quoted: false,
        inList: false, parenOpen: false, listHasValues: false,
      };
    }
  }

  // Operator typing:  status in|  /  status no|
  const operator = segment.match(new RegExp(`^\\s*([A-Za-z]+)\\s+([A-Za-z!<>= ]*)$`));
  if (operator && isQueryField(operator[1].toLowerCase())) {
    const field = operator[1].toLowerCase() as QueryField;
    const typed = operator[2];
    const normalized = normalizeOpToken(typed);
    const complete = normalized !== '' && isOperatorFor(field, normalized as QueryOperator);
    if (complete) {
      const op = normalized as QueryOperator;
      return {
        kind: 'value', field, op,
        start: caret, end: caret, typed: '', quoted: false,
        inList: op === 'in' || op === 'not in', parenOpen: false, listHasValues: false,
      };
    }
    const start = caret - typed.length;
    return { kind: 'operator', field, start, end: caret, typed };
  }

  // Field name:  st|  /  (after AND) |
  const fieldMatch = segment.match(/^\s*([A-Za-z]*)$/);
  if (fieldMatch) {
    const typed = fieldMatch[1];
    return { kind: 'field', start: caret - typed.length, end: caret, typed };
  }

  return null;
}

/**
 * Inserts the picked suggestion into the query text and returns the new caret offset.
 */
export function applySuggestion(
  value: string,
  ctx: SuggestionContext,
  item: SuggestionItem
): { value: string; caret: number } {
  const replace = (start: number, end: number, inserted: string): { value: string; caret: number } => {
    const next = value.slice(0, start) + inserted + value.slice(end);
    return { value: next, caret: start + inserted.length };
  };

  switch (ctx.kind) {
    case 'field': {
      // Date fields take unquoted values (date functions); others open a quote.
      const opensQuote = item.value !== 'updated';
      return replace(ctx.start, ctx.end, `${item.value} = ${opensQuote ? '"' : ''}`);
    }
    case 'operator': {
      const isList = item.value === 'in' || item.value === 'not in';
      if (isList) return replace(ctx.start, ctx.end, `${item.value} (`);
      // Date fields take unquoted values (date functions stay bare: startOfDay()).
      const quote = ctx.field === 'updated' ? '' : '"';
      return replace(ctx.start, ctx.end, `${item.value} ${quote}`);
    }
    case 'value': {
      // In-list picks append with a separator:  status in ("Done", "To Do", …
      // (a trailing comma is tolerated by the parser until the list is closed).
      if (ctx.inList && !ctx.parenOpen) {
        return replace(ctx.start, ctx.end, `("${item.value}", `);
      }
      if (ctx.inList && ctx.parenOpen) {
        return replace(ctx.start, ctx.end, `"${item.value}", `);
      }
      if (ctx.quoted) return replace(ctx.start, ctx.end, `"${item.value}" `);
      // Date functions are inserted unquoted:  updated >= startOfDay()
      if (item.value.endsWith('()')) return replace(ctx.start, ctx.end, `${item.value} `);
      return replace(ctx.start, ctx.end, `"${item.value}" `);
    }
    case 'logical': {
      const lead = ctx.start > 0 && !/\s/.test(value[ctx.start - 1]) ? ' ' : '';
      if (item.value === 'AND' || item.value === 'OR' || item.value === 'ORDER BY') {
        return replace(ctx.start, ctx.end, `${lead}${item.value} `);
      }
      const connector = ctx.typed.trim().toUpperCase() === 'OR' ? 'OR' : 'AND';
      const opensQuote = item.value !== 'updated';
      return replace(ctx.start, ctx.end, `${lead}${connector} ${item.value} = ${opensQuote ? '"' : ''}`);
    }
    case 'orderField':
      return replace(ctx.start, ctx.end, `${item.value} `);
    case 'orderDir':
      return replace(ctx.start, ctx.end, item.value.toUpperCase());
  }
}
