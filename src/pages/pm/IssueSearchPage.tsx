import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowUp, ArrowDown, Search, AlertCircle,
  Filter, SlidersHorizontal, Lock, CalendarRange, Star,
  MoreVertical, ExternalLink, FolderInput,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import { Avatar } from '../../components/common/Avatar';
import { WorkItemIcon } from '../../components/common/WorkItemIcon';
import { MoveTaskModal } from '../shared/tasks/MoveTaskModal';
import {
  QUERY_FIELDS, STATUS_LABELS, PRIORITY_LABELS, ISSUE_TYPE_LABELS,
  parseIssueQuery, matchesIssueQuery, normalizeValue, getSuggestionContext, applySuggestion,
  flattenClauses, operatorsFor, OPERATOR_HINTS, LOGICAL_SUGGESTIONS,
  ORDER_BY_FIELDS, ORDER_BY_FIELD_HINTS, DATE_FUNCTIONS, DATE_FUNCTION_HINTS,
  type IssueQueryFields, type QueryField, type SuggestionItem, type SuggestionContext,
} from '../../utils/issueQuery';
import {
  sortProjectSprints, buildProjectTeamMembers, buildSprintIssuesMap, resolveIssueTaskId,
  type IterationIssue,
} from '../../utils/sprintIssues';
import { buildSprintIdentifiers, formatSprintIdentifier, formatSprintFullTitle } from '../../utils/sprintIdentifier';
import { getProjectUrl, matchId, toUrlId } from '../../utils/idUtils';
import { getIssueKeyPrefix, getProjectKey } from '../../utils/projectIdentity';
import { issuePath } from '../../utils/issueUrl';
import type { Project, Sprint, Task } from '../../types';

const PAGE_SIZE = 50;

type ColumnKey = 'type' | 'key' | 'summary' | 'assignee' | 'updated' | 'sprint' | 'points';
type SortKey = ColumnKey;
type PresetKey =
  | 'all'
  | 'open'
  | 'done'
  | 'my-open'
  | 'my'
  | 'todo'
  | 'in-progress'
  | 'my-todo'
  | 'my-in-progress';
type BasicField = 'project' | 'sprint' | 'assignee' | 'status' | 'priority' | 'type';
type Mode = 'advanced' | 'basic';

interface SearchRow {
  issue: IterationIssue;
  project: Project;
  /** Null for Backlog rows — tasks not placed in any iteration. */
  sprint: Sprint | null;
  sprintTitle: string;
  projectId: string;
  fields: IssueQueryFields;
}

const DEFAULT_COLUMNS: ColumnKey[] = ['type', 'key', 'summary', 'assignee', 'updated', 'sprint', 'points'];

const COLUMNS: { key: ColumnKey; label: string; headerClass: string; cellClass: string }[] = [
  { key: 'type', label: 'Type', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'key', label: 'Key', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'summary', label: 'Summary', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'assignee', label: 'Assignee', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'updated', label: 'Updated', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'sprint', label: 'Iteration', headerClass: 'text-left', cellClass: 'px-3 py-2' },
  { key: 'points', label: 'Story Points', headerClass: 'text-right', cellClass: 'px-3 py-2 text-right' },
];

/** Column widths for table-fixed layout: pixels, or a percentage for `sprint` so
 *  narrow viewports wrap the Iteration cell instead of forcing table overflow. */
const COLUMN_WIDTHS: Record<ColumnKey, number | string | undefined> = {
  type: 60,
  key: 100,
  summary: undefined,
  assignee: 140,
  updated: 88,
  sprint: '20%',
  points: 92,
};

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All work items' },
  { key: 'open', label: 'Open work items' },
  { key: 'done', label: 'Done work items' },
  { key: 'my-open', label: 'My open work items' },
  { key: 'my', label: 'My work items' },
  { key: 'todo', label: 'To Do' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'my-todo', label: 'My To Do' },
  { key: 'my-in-progress', label: 'My In Progress' },
];

const UNAVAILABLE_FILTERS = ['Reported by Me', 'Viewed Recently', 'Created Recently', 'Resolved Recently'];

const BASIC_FIELDS: BasicField[] = ['project', 'sprint', 'assignee', 'status', 'priority', 'type'];

const FIELD_HINTS: Record<QueryField, string> = {
  sprint: 'Iteration, e.g. KEY4.1',
  project: 'Project key',
  assignee: 'Person (partial match)',
  status: 'Workflow status',
  priority: 'Priority level',
  type: 'Story, Task, Bug or Epic',
  key: 'Issue key, e.g. KEY-1101',
  updated: 'Last updated date, e.g. startOfDay()',
};

const TYPE_RANK: Record<IterationIssue['type'], number> = { EPIC: 0, STORY: 1, TASK: 2, BUG: 3 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatUpdated = (iso: string): string => {
  const [y, m, d] = (iso || '').split('T')[0].split('-');
  if (!y || !m || !d) return iso || '—';
  return `${d}/${MONTHS[Number(m) - 1] || m}/${y.slice(2)}`;
};

const issueTypeLabel = (type: IterationIssue['type']): string =>
  type === 'STORY' ? 'Story' : type === 'BUG' ? 'Bug' : type === 'EPIC' ? 'Epic' : 'Task';

const PriorityGlyph: React.FC<{ priority: IterationIssue['priority'] }> = ({ priority }) => {
  const styles: Record<IterationIssue['priority'], { glyph: string; cls: string }> = {
    CRITICAL: { glyph: '⇈', cls: 'text-red-600 font-black' },
    HIGH: { glyph: '═', cls: 'text-[#ff5630] font-bold' },
    MEDIUM: { glyph: '═', cls: 'text-[#ffab00] font-bold' },
    LOW: { glyph: '⇊', cls: 'text-[#36b37e] font-bold' },
  };
  const s = styles[priority] || styles.MEDIUM;
  return (
    <span className={`${s.cls} text-xs leading-none flex-shrink-0`} title={`Priority: ${priority}`}>
      {s.glyph}
    </span>
  );
};

export const IssueSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, sprints, tasks, users, teams } = useAppStore();
  const { currentUser } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const buildInitialQuery = (params: URLSearchParams): string => {
    const q = params.get('q');
    if (q && q.trim()) return q.trim();
    const sprintParam = params.get('sprint');
    if (sprintParam) {
      const sprint = sprints.find((s) => matchId(s.id, sprintParam));
      if (sprint) {
        const project = projects.find((p) => p.id === sprint.projectId);
        const key = project ? getIssueKeyPrefix(project) || 'PRJ' : '';
        if (key) {
          const identifiers = buildSprintIdentifiers(sortProjectSprints(sprints, sprint.projectId), key);
          const identifier = identifiers[sprint.id];
          if (identifier) return `sprint = "${identifier}"`;
        }
      }
    }
    return '';
  };

  const [queryInput, setQueryInput] = useState(() => buildInitialQuery(searchParams));
  const [appliedQuery, setAppliedQuery] = useState(() => buildInitialQuery(searchParams));
  const [mode, setMode] = useState<Mode>('advanced');
  const [preset, setPreset] = useState<PresetKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    try {
      const raw = sessionStorage.getItem('flowexec.issueSearch.visibleColumns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((c): c is ColumnKey => (DEFAULT_COLUMNS as string[]).includes(c));
          if (!valid.includes('summary')) valid.unshift('summary');
          return valid;
        }
      }
    } catch {
      // fall through to defaults
    }
    return DEFAULT_COLUMNS;
  });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [basic, setBasic] = useState<Record<BasicField, string>>({
    project: '', sprint: '', status: '', priority: '', type: '', assignee: '',
  });
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionCtx, setSuggestionCtx] = useState<SuggestionContext | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  /** True once the user arrow-navigated the dropdown: Enter then picks instead of searching. */
  const navUsedRef = useRef(false);

  // Live validation (non-blocking): red border + hint while the query can't parse.
  const liveParse = useMemo(() => parseIssueQuery(queryInput), [queryInput]);
  const queryInvalid = queryInput.trim() !== '' && !liveParse.ok;

  // Keep the editor in sync with the URL (deep-link load, browser back/forward).
  const searchStr = searchParams.toString();
  useEffect(() => {
    const next = buildInitialQuery(new URLSearchParams(searchStr));
    setQueryInput(next);
    setAppliedQuery(next);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

  useEffect(() => {
    try {
      sessionStorage.setItem('flowexec.issueSearch.visibleColumns', JSON.stringify(visibleColumns));
    } catch {
      // storage unavailable — keep in-memory state
    }
  }, [visibleColumns]);

  const sprintLookup = useMemo(() => {
    const list: { sprint: Sprint; project: Project; identifier: string; title: string }[] = [];
    projects.forEach((project) => {
      const projectSprints = sortProjectSprints(sprints, project.id);
      const key = getIssueKeyPrefix(project) || 'PRJ';
      const identifiers = buildSprintIdentifiers(projectSprints, key);
      projectSprints.forEach((s) => {
        list.push({
          sprint: s,
          project,
          identifier: identifiers[s.id],
          title: formatSprintFullTitle(s, key, identifiers),
        });
      });
    });
    return list;
  }, [projects, sprints]);

  // The exact same issue records and counts the Iterations page renders, across every
  // project — real sprint tasks topped up with the shared domain seed items — plus
  // each project's Backlog (store tasks not placed in any iteration), so queries
  // like assignee = "X" span Backlog and every iteration with no implicit
  // sprint restriction.
  const allRows = useMemo<SearchRow[]>(() => {
    const rows: SearchRow[] = [];
    projects.forEach((project) => {
      const projectSprints = sortProjectSprints(sprints, project.id);
      const projectKey = getIssueKeyPrefix(project) || 'PRJ';
      const identifiers = buildSprintIdentifiers(projectSprints, projectKey);
      const projectTeamMembers = buildProjectTeamMembers(project, teams, users);
      const map = buildSprintIssuesMap({
        tasks, users, project, projectId: project.id, projectKey, projectTeamMembers, projectSprints,
      });
      projectSprints.forEach((sprint) => {
        const issues = map[sprint.id] || [];
        const sprintTitle = formatSprintFullTitle(sprint, projectKey, identifiers);
        const sprintIdentifier = formatSprintIdentifier(sprint, projectKey, identifiers);
        issues.forEach((issue) => {
          rows.push({
            issue,
            project,
            sprint,
            sprintTitle,
            projectId: project.id,
            fields: {
              sprint: [sprintIdentifier, sprint.name, sprintTitle, sprint.id],
              // The "Project key" facet keeps the project's KEY (identity), while
              // sprint/issue keys above use the derived issue prefix.
              project: [getProjectKey(project) || 'PRJ', project.name],
              assignee: issue.assigneeName,
              // Cancelled (real status or legacy DONE + resolution) never matches "Done".
              status: isCancelledWorkItem(issue)
                ? 'Cancelled'
                : STATUS_LABELS[issue.status],
              priority: issue.priority,
              type: issue.type,
              key: issue.key,
              updated: (issue.updatedDate || '').split('T')[0],
            },
          });
        });
      });

      // Backlog rows: real store tasks with no sprint, mapped exactly like sprint
      // tasks (issueQuery.ts matchesClause: fields.sprint = [] means `sprint = "…"`
      // never matches a backlog row while `sprint != "…"` does).
      const backlogTasks = tasks.filter((t) => t.projectId === project.id && !t.sprintId);
      backlogTasks.forEach((t) => {
        const assignee = users.find((u) => u.id === t.assigneeId);
        const issueType: IterationIssue['type'] =
          t.type === 'BUG_FIX' ? 'BUG' : t.type === 'EPIC' ? 'EPIC' : 'STORY';
        rows.push({
          issue: {
            id: t.id,
            key: t.issueKey || '',
            title: t.title,
            type: issueType,
            priority: t.priority,
            status: t.status,
            resolution: t.status === 'DONE' ? t.resolution : undefined,
            releaseTag: `${projectKey} PI24`,
            epicName: '',
            epicColor: '',
            assigneeName: assignee ? assignee.name : 'Unassigned',
            assigneeInitial: assignee ? assignee.name[0] : 'U',
            assigneeAvatarColor: assignee?.avatarColor || '#3b82f6',
            avatarUrl: assignee?.avatarUrl,
            storyPoints: t.storyPoints || 3,
            updatedDate: t.updatedAt || t.createdAt,
          },
          project,
          sprint: null,
          sprintTitle: 'Backlog',
          projectId: project.id,
          fields: {
            sprint: [],
            project: [getProjectKey(project) || 'PRJ', project.name],
            assignee: assignee ? assignee.name : 'Unassigned',
            status: isCancelledWorkItem(t) ? 'Cancelled' : STATUS_LABELS[t.status],
            priority: t.priority,
            type: issueType,
            key: t.issueKey || '',
            updated: (t.updatedAt || t.createdAt || '').split('T')[0],
          },
        });
      });
    });
    return rows;
  }, [projects, sprints, tasks, users, teams]);

  const appliedParsed = useMemo(() => {
    const result = parseIssueQuery(appliedQuery);
    return result.ok ? result.query : { groups: [] };
  }, [appliedQuery]);
  const clauses = useMemo(() => flattenClauses(appliedParsed), [appliedParsed]);

  const resolveSprint = (value: string) => {
    const wanted = normalizeValue(value);
    return sprintLookup.find((entry) =>
      [entry.identifier, entry.sprint.name, entry.title, entry.sprint.id].some(
        (candidate) => normalizeValue(candidate) === wanted
      )
    );
  };

  const sprintClause = clauses.filter((c) => c.field === 'sprint').pop();
  const sprintContext = sprintClause ? resolveSprint(sprintClause.values[0]) : undefined;

  const isOpenIssue = (r: SearchRow) => r.issue.status !== 'DONE';
  const isMyIssue = (r: SearchRow) =>
    !!currentUser?.name &&
    normalizeValue(r.fields.assignee).includes(normalizeValue(currentUser.name));

  const queryMatched = useMemo(
    () => allRows.filter((r) => matchesIssueQuery(appliedParsed, r.fields)),
    [allRows, appliedParsed]
  );

  const presetCounts = useMemo(() => {
    const counts: Record<PresetKey, number> = {
      all: queryMatched.length,
      open: queryMatched.filter(isOpenIssue).length,
      done: queryMatched.filter((r) => !isOpenIssue(r)).length,
      'my-open': queryMatched.filter((r) => isOpenIssue(r) && isMyIssue(r)).length,
      my: queryMatched.filter(isMyIssue).length,
      todo: queryMatched.filter((r) => r.issue.status === 'TODO').length,
      'in-progress': queryMatched.filter((r) => r.issue.status === 'IN_PROGRESS').length,
      'my-todo': queryMatched.filter((r) => isMyIssue(r) && r.issue.status === 'TODO').length,
      'my-in-progress': queryMatched.filter(
        (r) => isMyIssue(r) && r.issue.status === 'IN_PROGRESS'
      ).length,
    };
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMatched, currentUser]);

  const results = useMemo(() => {
    switch (preset) {
      case 'open':
        return queryMatched.filter(isOpenIssue);
      case 'done':
        return queryMatched.filter((r) => !isOpenIssue(r));
      case 'my-open':
        return queryMatched.filter((r) => isOpenIssue(r) && isMyIssue(r));
      case 'my':
        return queryMatched.filter(isMyIssue);
      case 'todo':
        return queryMatched.filter((r) => r.issue.status === 'TODO');
      case 'in-progress':
        return queryMatched.filter((r) => r.issue.status === 'IN_PROGRESS');
      case 'my-todo':
        return queryMatched.filter((r) => isMyIssue(r) && r.issue.status === 'TODO');
      case 'my-in-progress':
        return queryMatched.filter((r) => isMyIssue(r) && r.issue.status === 'IN_PROGRESS');
      default:
        return queryMatched;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMatched, preset, currentUser]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const value = (r: SearchRow): string | number => {
      switch (sortKey) {
        case 'type':
          return TYPE_RANK[r.issue.type];
        case 'key':
          return r.issue.key;
        case 'summary':
          return r.issue.title;
        case 'assignee':
          return r.fields.assignee;
        case 'updated':
          return r.issue.updatedDate;
        case 'sprint':
          return r.sprintTitle;
        case 'points':
          return r.issue.storyPoints;
        default:
          return '';
      }
    };
    return [...results].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [results, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, sorted.length);
  const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];
    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) nums.push(i);
      return nums;
    }
    nums.push(1);
    const from = Math.max(2, currentPage - 1);
    const to = Math.min(pageCount - 1, currentPage + 1);
    if (from > 2) nums.push('…');
    for (let i = from; i <= to; i++) nums.push(i);
    if (to < pageCount - 1) nums.push('…');
    nums.push(pageCount);
    return nums;
  }, [pageCount, currentPage]);

  const applyText = (text: string): boolean => {
    const result = parseIssueQuery(text);
    if (!result.ok) {
      // Invalid: keep the previous results on screen; the border hint explains why.
      setSuggestionsOpen(false);
      return false;
    }
    setSuggestionsOpen(false);
    setQueryInput(text);
    setAppliedQuery(text);
    setPage(1);

    if (result.query.orderBy) {
      setSortKey(result.query.orderBy.field);
      setSortDir(result.query.orderBy.dir);
    }

    const params = new URLSearchParams();
    const trimmed = text.trim();
    if (trimmed) params.set('q', trimmed);
    const sprintPart = flattenClauses(result.query).filter((c) => c.field === 'sprint').pop();
    if (sprintPart) {
      const entry = resolveSprint(sprintPart.values[0]);
      if (entry) params.set('sprint', toUrlId(entry.sprint.id));
    }
    setSearchParams(params);
    return true;
  };

  const valueSuggestionsFor = (field: QueryField): SuggestionItem[] => {
    switch (field) {
      case 'sprint':
        // Label shows the full sprint title; the bare identifier is what gets inserted.
        return sprintLookup.map((e) => ({ label: e.title, value: e.identifier, hint: e.project.name }));
      case 'project':
        return projects.map((p) => ({
          label: (p.key || 'PRJ').toUpperCase(),
          value: (p.key || 'PRJ').toUpperCase(),
          hint: p.name,
        }));
      case 'assignee':
        return [...new Set(allRows.map((r) => r.issue.assigneeName))].map((name) => ({ label: name, value: name }));
      case 'status':
        return [...new Set([...Object.values(STATUS_LABELS), 'Cancelled'])].map((s) => ({ label: s, value: s }));
      case 'priority':
        return PRIORITY_LABELS.map((p) => ({ label: p, value: p }));
      case 'type':
        return ISSUE_TYPE_LABELS.map((t) => ({ label: t, value: t }));
      case 'key':
        return [...new Set(allRows.map((r) => r.issue.key))].map((k) => ({ label: k, value: k }));
      case 'updated':
        return DATE_FUNCTIONS.map((d) => ({ label: d, value: d, hint: DATE_FUNCTION_HINTS[d] }));
      default:
        return [];
    }
  };

  const fieldSuggestions = (): SuggestionItem[] =>
    QUERY_FIELDS.map((f) => ({ label: f, value: f, hint: FIELD_HINTS[f] }));

  const refreshSuggestions = (value: string, caret: number, preserveActive = false) => {
    const ctx = getSuggestionContext(value, caret);
    setSuggestionCtx(ctx);
    if (!ctx) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setActiveSuggestion(0);
      return;
    }

    let pool: SuggestionItem[];
    let filter: string;
    switch (ctx.kind) {
      case 'field':
        pool = fieldSuggestions();
        filter = ctx.typed;
        break;
      case 'operator':
        pool = operatorsFor(ctx.field).map((op) => ({ label: op, value: op, hint: OPERATOR_HINTS[op] }));
        filter = ctx.typed;
        break;
      case 'value':
        pool = valueSuggestionsFor(ctx.field);
        filter = ctx.typed.replace(/^["']|["']$/g, '');
        break;
      case 'logical':
        // Connectors are always offered; only fields filter by the typed prefix.
        pool = [
          ...LOGICAL_SUGGESTIONS,
          ...QUERY_FIELDS.filter((f) => f.startsWith(ctx.typed.toLowerCase())).map((f) => ({
            label: f, value: f, hint: FIELD_HINTS[f],
          })),
        ];
        filter = '';
        break;
      case 'orderField':
        pool = ORDER_BY_FIELDS.map((f) => ({ label: f, value: f, hint: ORDER_BY_FIELD_HINTS[f] }));
        filter = ctx.typed;
        break;
      case 'orderDir':
        pool = [
          { label: 'ASC', value: 'ASC', hint: 'Lowest / A → Z first' },
          { label: 'DESC', value: 'DESC', hint: 'Highest / Z → A first' },
        ];
        filter = ctx.typed;
        break;
      default:
        pool = [];
        filter = '';
    }

    const lowered = filter.toLowerCase();
    const filtered = pool.filter((i) => i.label.toLowerCase().startsWith(lowered)).slice(0, 15);
    setSuggestions(filtered);
    // Arrow keys fire a trailing native 'select' event; keep the highlighted row while keyboard-navigating.
    setActiveSuggestion((prev) => (preserveActive && filtered.length > 0 ? Math.min(prev, filtered.length - 1) : 0));
    setSuggestionsOpen(filtered.length > 0);
  };

  const applySuggestionAt = (index: number) => {
    if (!suggestionCtx || !suggestions[index]) return;
    const { value: next, caret } = applySuggestion(queryInput, suggestionCtx, suggestions[index]);
    navUsedRef.current = false;
    setQueryInput(next);
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
      refreshSuggestions(next, caret);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    navUsedRef.current = false;
    setQueryInput(value);
    refreshSuggestions(value, e.target.selectionStart ?? value.length);
  };

  const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    refreshSuggestions(el.value, el.selectionStart ?? el.value.length, navUsedRef.current);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = suggestionsOpen && suggestions.length > 0;
    if (e.key === 'ArrowDown') {
      if (open) {
        e.preventDefault();
        navUsedRef.current = true;
        setActiveSuggestion((i) => (i + 1) % suggestions.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      if (open) {
        e.preventDefault();
        navUsedRef.current = true;
        setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length);
      }
      return;
    }
    if (e.key === 'Tab') {
      if (open) {
        e.preventDefault();
        applySuggestionAt(activeSuggestion);
      }
      return;
    }
    if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Arrow-navigated? Pick the highlighted row; otherwise run the search.
      if (navUsedRef.current && open) {
        applySuggestionAt(activeSuggestion);
        return;
      }
      setSuggestionsOpen(false);
      applyText(queryInput);
    }
  };

  const buildBasicQuery = (): string => {
    const parts: string[] = [];
    BASIC_FIELDS.forEach((field) => {
      const value = basic[field].trim().replace(/"/g, '');
      if (value) parts.push(`${field} = "${value}"`);
    });
    return parts.join(' AND ');
  };

  const switchMode = (next: Mode) => {
    if (next === 'basic') {
      const parsed = parseIssueQuery(appliedQuery);
      const init: Record<BasicField, string> = {
        project: '', sprint: '', assignee: '', status: '', priority: '', type: '',
      };
      if (parsed.ok) {
        flattenClauses(parsed.query).forEach((c) => {
          if ((BASIC_FIELDS as string[]).includes(c.field)) {
            init[c.field as BasicField] = c.values[0] || '';
          }
        });
      }
      setBasic(init);
    }
    setMode(next);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'updated' ? 'desc' : 'asc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    if (key === 'summary') return;
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const openRow = (row: SearchRow, newTab = false) => {
    const taskId = resolveIssueTaskId({
      issue: row.issue,
      projectId: row.projectId,
      sprintId: row.sprint?.id,
      users,
      currentUser,
    });
    const url = issuePath(taskId);
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else navigate(url);
  };

  // ---- Row action menu (the only row-level path to Open / Move Work Item) ----
  const [rowMenu, setRowMenu] = useState<{ row: SearchRow; x: number; y: number } | null>(null);
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!rowMenu) return;
    // Close on any click outside the trigger or the menu itself — both carry
    // data-row-menu, no matter which row currently renders them.
    const handleDocMouseDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('[data-row-menu]')) return;
      setRowMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowMenu(null);
    };
    const handleScroll = () => setRowMenu(null);
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [rowMenu]);

  const toggleRowMenu = (e: React.MouseEvent, row: SearchRow) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const MENU_W = 176;
    const pos = {
      x: Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8)),
      y: Math.min(rect.bottom + 4, window.innerHeight - 88),
    };
    setRowMenu((prev) => (prev && prev.row.issue.id === row.issue.id ? null : { row, ...pos }));
  };

  const rowMenuOpen = () => {
    if (!rowMenu) return;
    const row = rowMenu.row;
    setRowMenu(null);
    openRow(row);
  };

  const rowMenuMove = () => {
    if (!rowMenu) return;
    const row = rowMenu.row;
    setRowMenu(null);
    // resolveIssueTaskId materialises seed issues into real store tasks, so the
    // existing Move flow always receives an actual work item — never a fake one.
    const taskId = resolveIssueTaskId({
      issue: row.issue,
      projectId: row.projectId,
      sprintId: row.sprint?.id,
      users,
      currentUser,
    });
    const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
    if (task) setMovingTask(task);
  };

  const handleBack = () => {
    if (sprintContext) navigate(`${getProjectUrl(sprintContext.project)}/iterations`);
    else navigate(-1);
  };

  const vis = (key: ColumnKey) => visibleColumns.includes(key);
  const shownColumns = COLUMNS.filter((c) => visibleColumns.includes(c.key));

  const sprintOptions = useMemo(() => {
    if (basic.project) {
      const project = projects.find((p) => (p.key || 'PRJ').toUpperCase() === basic.project);
      if (project) {
        const key = getIssueKeyPrefix(project) || 'PRJ';
        const projectSprints = sortProjectSprints(sprints, project.id);
        const identifiers = buildSprintIdentifiers(projectSprints, key);
        return projectSprints.map((s) => ({
          value: identifiers[s.id],
          label: `${identifiers[s.id]} — ${s.name}`,
        }));
      }
    }
    return sprintLookup.map((e) => ({ value: e.identifier, label: `${e.identifier} — ${e.project.name}` }));
  }, [basic.project, projects, sprints, sprintLookup]);

  const assigneeOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.issue.assigneeName))],
    [allRows]
  );

  return (
    <div className="min-h-0 min-w-0 flex flex-col -mt-2 gap-2.5 overflow-x-clip">
      {/* Breadcrumb row: Back | <Project Name> | Issue Search */}
      <div className="flex-shrink-0 flex items-center gap-2.5 flex-wrap pb-1">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368] hover:text-[#1a73e8] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {sprintContext ? 'Back to Iterations' : 'Back'}
        </button>
        {sprintContext && (
          <>
            <div className="w-px h-4 bg-slate-300 flex-shrink-0" />
            <span className="text-sm font-semibold text-[#5f6368] truncate max-w-[220px] flex-shrink-0">
              {sprintContext.project.name}
            </span>
            <div className="w-px h-4 bg-slate-300 flex-shrink-0" />
          </>
        )}
        <h1 className="text-lg font-bold text-[#1f1f1f] tracking-tight font-display flex-shrink-0">
          Issue Search
        </h1>
      </div>

      {/* Query bar */}
      <div className="relative flex-shrink-0 card p-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => switchMode('advanced')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'advanced' ? 'bg-white shadow-xs text-[#1a73e8]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Advanced
            </button>
            <button
              type="button"
              onClick={() => switchMode('basic')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'basic' ? 'bg-white shadow-xs text-[#1a73e8]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Basic
            </button>
          </div>

          {mode === 'advanced' ? (
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="text"
                value={queryInput}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onSelect={handleInputSelect}
                onFocus={(e) => refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                placeholder='Search issues — e.g. sprint = "KEY4.1" AND status = "In Progress"'
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                className={`input pl-9 pr-3 text-xs ${
                  queryInvalid ? 'border-[#de350b] hover:border-[#de350b] focus:border-[#de350b] focus:ring-[#de350b]/25' : ''
                }`}
                aria-label="Issue search query"
                aria-invalid={queryInvalid}
              />
              {suggestionsOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 card p-1 max-h-64 overflow-y-auto">
                  {suggestions.map((item, i) => (
                    <button
                      key={`${item.value}-${i}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestionAt(i);
                      }}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                        i === activeSuggestion ? 'bg-[#deebff]' : 'hover:bg-[#f4f5f7]'
                      }`}
                    >
                      <span className="font-semibold text-[#172b4d] truncate">{item.label}</span>
                      {item.hint && (
                        <span className="text-[10px] text-[#9aa0a6] truncate max-w-[240px] flex-shrink-0">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[260px]">
              <select
                value={basic.project}
                onChange={(e) =>
                  setBasic((prev) => {
                    const next = { ...prev, project: e.target.value };
                    if (prev.sprint && e.target.value) {
                      const entry = sprintLookup.find((s) => s.identifier === prev.sprint);
                      if (entry && (entry.project.key || 'PRJ').toUpperCase() !== e.target.value) {
                        next.sprint = '';
                      }
                    }
                    return next;
                  })
                }
                className="input w-auto text-xs py-1.5"
                aria-label="Project"
              >
                <option value="">Any project</option>
                {projects.map((p) => (
                  <option key={p.id} value={(p.key || 'PRJ').toUpperCase()}>
                    {(p.key || 'PRJ').toUpperCase()} — {p.name}
                  </option>
                ))}
                {basic.project && !projects.some((p) => (p.key || 'PRJ').toUpperCase() === basic.project) && (
                  <option value={basic.project}>{basic.project}</option>
                )}
              </select>
              <select
                value={basic.sprint}
                onChange={(e) => setBasic((prev) => ({ ...prev, sprint: e.target.value }))}
                className="input w-auto text-xs py-1.5"
                aria-label="Iteration"
              >
                <option value="">Any iteration</option>
                {sprintOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {basic.sprint && !sprintOptions.some((o) => o.value === basic.sprint) && (
                  <option value={basic.sprint}>{basic.sprint}</option>
                )}
              </select>
              <select
                value={basic.assignee}
                onChange={(e) => setBasic((prev) => ({ ...prev, assignee: e.target.value }))}
                className="input w-auto text-xs py-1.5"
                aria-label="Assignee"
              >
                <option value="">Anyone</option>
                {assigneeOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {basic.assignee && !assigneeOptions.includes(basic.assignee) && (
                  <option value={basic.assignee}>{basic.assignee}</option>
                )}
              </select>
              <select
                value={basic.status}
                onChange={(e) => setBasic((prev) => ({ ...prev, status: e.target.value }))}
                className="input w-auto text-xs py-1.5"
                aria-label="Status"
              >
                <option value="">Any status</option>
                {[...new Set([...Object.values(STATUS_LABELS), 'Cancelled'])].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={basic.priority}
                onChange={(e) => setBasic((prev) => ({ ...prev, priority: e.target.value }))}
                className="input w-auto text-xs py-1.5"
                aria-label="Priority"
              >
                <option value="">Any priority</option>
                {PRIORITY_LABELS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={basic.type}
                onChange={(e) => setBasic((prev) => ({ ...prev, type: e.target.value }))}
                className="input w-auto text-xs py-1.5"
                aria-label="Type"
              >
                <option value="">Any type</option>
                {ISSUE_TYPE_LABELS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => applyText(mode === 'advanced' ? queryInput : buildBasicQuery())}
            disabled={mode === 'advanced' && queryInvalid}
            className="btn-primary btn-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>

          <div className="relative flex-shrink-0 z-30">
            {columnsOpen && (
              <div className="fixed inset-0 z-20" onClick={() => setColumnsOpen(false)} aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => setColumnsOpen((o) => !o)}
              className="btn-ghost btn-sm flex-shrink-0"
              aria-label="Choose columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 card p-2 z-30">
                <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">
                  Columns
                </p>
                {COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs text-[#42526e] hover:bg-[#f4f5f7] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      disabled={col.key === 'summary'}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-[#dfe1e6] text-[#0052cc] focus:ring-[#0052cc] cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className={col.key === 'summary' ? 'text-[#9aa0a6]' : ''}>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {queryInvalid && mode === 'advanced' && (
          <p className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-[#de350b]">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            Invalid query — check the field name, operator and quotes, e.g. sprint = "KEY4.1" AND status = "Done".
          </p>
        )}
      </div>

      {/* Quick filter row — preset chips (with live counts), Favourite Filters
          and More Filters in ONE horizontal line directly below the search
          bar, replacing the old vertical sidebar so the results table can
          use the full content width. Chips never wrap: the row scrolls
          horizontally on narrow viewports instead. */}
      <div className="flex-shrink-0 flex items-center gap-1.5 min-w-0 flex-nowrap overflow-x-auto pb-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPreset(p.key);
              setPage(1);
            }}
            aria-pressed={preset === p.key}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
              preset === p.key
                ? 'bg-[#0052cc] text-white'
                : 'bg-[#f1f2f4] text-[#5f6368] hover:bg-[#e4e6ea] hover:text-[#172b4d]'
            }`}
          >
            <span>{p.label}</span>
            <span
              className={`text-[10px] tabular-nums ${
                preset === p.key ? 'text-white/80' : 'text-[#9aa0a6]'
              }`}
            >
              {presetCounts[p.key]}
            </span>
          </button>
        ))}

        {/* Favourite Filters — compact star dropdown. The section stays
            reachable even with no favourites (the empty state lives inside
            the menu, never as a large block of its own). */}
        <div className="relative flex-shrink-0 z-30">
          {favOpen && (
            <div className="fixed inset-0 z-20" onClick={() => setFavOpen(false)} aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setFavOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={favOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
              favOpen
                ? 'bg-[#deebff] text-[#0052cc]'
                : 'bg-[#f1f2f4] text-[#5f6368] hover:bg-[#e4e6ea] hover:text-[#172b4d]'
            }`}
          >
            <Star className="w-3 h-3" />
            Favourite Filters
          </button>
          {favOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 card p-2 z-30" role="menu">
              <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">
                Favourite Filters
              </p>
              <p className="px-1.5 py-2 text-[11px] italic text-[#9aa0a6]">No favourite filters yet.</p>
            </div>
          )}
        </div>

        {/* Secondary filters — inline when the viewport is wide enough to fit
            them beside the presets; otherwise they collapse into the More
            Filters dropdown so the row stays a single line. */}
        {UNAVAILABLE_FILTERS.map((label) => (
          <span
            key={label}
            title="Not available with current data"
            className="hidden 2xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap text-[#b6bbc4] bg-[#f1f2f4] border border-[#e4e6ea] cursor-not-allowed select-none flex-shrink-0"
          >
            <Lock className="w-3 h-3" />
            {label}
          </span>
        ))}
        <div className="relative flex-shrink-0 z-30 2xl:hidden">
          {moreOpen && (
            <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
              moreOpen
                ? 'bg-[#deebff] text-[#0052cc]'
                : 'bg-[#f1f2f4] text-[#5f6368] hover:bg-[#e4e6ea] hover:text-[#172b4d]'
            }`}
          >
            <Filter className="w-3 h-3" />
            More Filters
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 card p-1.5 z-30" role="menu">
              <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">
                More filters
              </p>
              {UNAVAILABLE_FILTERS.map((label) => (
                <span
                  key={label}
                  title="Not available with current data"
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-[#b6bbc4] bg-[#fafbfc] border border-[#eef0f3] cursor-not-allowed select-none"
                >
                  <span className="truncate">{label}</span>
                  <Lock className="w-3 h-3 flex-shrink-0" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Iteration context banner */}
      {sprintContext && (
        <div className="flex-shrink-0 card px-4 py-3 flex items-center justify-between gap-3 border-l-4 border-l-[#0052cc]">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarRange className="w-4 h-4 text-[#0052cc] flex-shrink-0" />
            <span className="text-sm font-bold text-[#172b4d] truncate" title={sprintContext.title}>
              {sprintContext.title}
            </span>
            <span className="w-px h-4 bg-slate-300 flex-shrink-0" />
            <span className="text-xs font-semibold text-[#5f6368] truncate">
              {sprintContext.project.name}
            </span>
          </div>
          <span className="text-xs font-bold text-[#5f6368] flex-shrink-0">
            {results.length} {results.length === 1 ? 'issue' : 'work items'}
          </span>
        </div>
      )}

      {/* Results — full width now that the filters live in the row above */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col card overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#e0e2ec] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-semibold text-[#5f6368]">
              {sorted.length} {sorted.length === 1 ? 'issue' : 'work items'}
              {preset !== 'all' && (
                <span className="text-[#9aa0a6] font-normal">
                  {' '}
                  · {PRESETS.find((p) => p.key === preset)?.label}
                </span>
              )}
            </span>
          </div>

          {/* Results table */}
          <div className="flex-1 min-h-0 overflow-auto">
            {pageRows.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <Search className="w-8 h-8 mx-auto text-[#c5c8ce] mb-3" />
                <p className="text-sm font-semibold text-[#5f6368]">No work items found</p>
                <p className="text-xs text-[#9aa0a6] mt-1">
                  Try changing your search query or filters.
                </p>
              </div>
            ) : (
              <table className="w-full table-fixed text-xs border-collapse">
                <colgroup>
                  {shownColumns.map((col) => (
                    <col key={col.key} style={COLUMN_WIDTHS[col.key] ? { width: COLUMN_WIDTHS[col.key] } : undefined} />
                  ))}
                  <col style={{ width: 44 }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#f7f8fa] shadow-[0_1px_0_#e0e2ec]">
                  <tr>
                    {shownColumns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6b778c] whitespace-nowrap overflow-hidden cursor-pointer select-none hover:text-[#0052cc] transition-colors ${col.headerClass}`}
                        title={`Sort by ${col.label}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#0052cc]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#0052cc]" />
                            ))}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 w-11" aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={`${row.projectId}-${row.sprint?.id ?? 'backlog'}-${row.issue.id}`}
                      className="border-b border-[#f1f2f4] hover:bg-[#f4f5f7] transition-colors"
                    >
                      {vis('type') && (
                        <td className="px-3 py-2 overflow-hidden">
                          <WorkItemIcon typeLabel={issueTypeLabel(row.issue.type)} />
                        </td>
                      )}
                      {vis('key') && (
                        <td className="px-3 py-2 overflow-hidden">
                          <span
                            className="block w-full text-left font-semibold text-[#0052cc] truncate"
                            title={row.issue.key}
                          >
                            {row.issue.key}
                          </span>
                        </td>
                      )}
                      {vis('summary') && (
                        <td className="px-3 py-2 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <PriorityGlyph priority={row.issue.priority} />
                            <span
                              className="min-w-0 font-medium text-[#172b4d] transition-colors truncate text-left"
                              title={row.issue.title}
                            >
                              {row.issue.title}
                            </span>
                            {row.issue.epicName && (
                              <span
                                className={`hidden md:inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide max-w-[120px] truncate flex-shrink-0 ${row.issue.epicColor}`}
                                title={row.issue.epicName}
                              >
                                {row.issue.epicName}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {vis('assignee') && (
                        <td className="px-3 py-2 overflow-hidden">
                          {row.issue.assigneeName === 'Unassigned' ? (
                            <span className="block truncate text-[#9aa0a6] italic">Unassigned</span>
                          ) : (
                            <span className="flex items-center gap-2 min-w-0">
                              <Avatar
                                name={row.issue.assigneeName}
                                color={row.issue.assigneeAvatarColor}
                                size="xs"
                                imageUrl={row.issue.avatarUrl}
                                className="flex-shrink-0"
                              />
                              <span className="min-w-0 truncate text-[#42526e]">
                                {row.issue.assigneeName}
                              </span>
                            </span>
                          )}
                        </td>
                      )}
                      {vis('updated') && (
                        <td className="px-3 py-2 overflow-hidden whitespace-nowrap text-[#42526e]">
                          {formatUpdated(row.issue.updatedDate)}
                        </td>
                      )}
                      {vis('sprint') && (
                        <td className="px-3 py-2">
                          <span className="block whitespace-normal break-words text-[#42526e]">
                            {row.sprintTitle}
                          </span>
                        </td>
                      )}
                      {vis('points') && (
                        <td className="px-3 py-2 text-right font-semibold text-[#42526e] overflow-hidden whitespace-nowrap">
                          {row.issue.storyPoints || '—'}
                        </td>
                      )}
                      {/* Row action trigger + menu (rendered inside the open row) */}
                      <td className="px-2 py-2 text-center">
                        <span className="relative inline-flex" data-row-menu="">
                          <button
                            type="button"
                            onClick={(e) => toggleRowMenu(e, row)}
                            className="p-1 rounded-lg text-[#6b778c] hover:bg-[#dfe1e6] hover:text-[#172b4d] transition-colors"
                            title="Row actions"
                            aria-label={`Actions for ${row.issue.key || row.issue.title}`}
                            aria-haspopup="menu"
                            aria-expanded={!!rowMenu && rowMenu.row.issue.id === row.issue.id}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {rowMenu && rowMenu.row.issue.id === row.issue.id && (
                            <div
                              data-row-menu=""
                              role="menu"
                              className="fixed z-50 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in"
                              style={{ left: rowMenu.x, top: rowMenu.y }}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={rowMenuOpen}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                Open
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={rowMenuMove}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                                Move Work Item
                              </button>
                            </div>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {sorted.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-[#e0e2ec] bg-[#fafbfc] flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-[#6b778c]">
                Showing results {startIdx + 1}-{endIdx} of {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {'< Previous'}
                </button>
                {pageNumbers.map((n, i) =>
                  n === '…' ? (
                    <span key={`gap-${i}`} className="px-1 text-[11px] text-[#9aa0a6]">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`btn-ghost btn-sm px-2.5 text-xs font-semibold ${
                        n === currentPage ? 'bg-[#deebff] text-[#0052cc]' : 'text-slate-500'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {'Next >'}
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Move Work Item — the existing move flow, opened from the row action menu */}
      <MoveTaskModal
        isOpen={!!movingTask}
        task={movingTask}
        onClose={() => setMovingTask(null)}
      />
    </div>
  );
};
