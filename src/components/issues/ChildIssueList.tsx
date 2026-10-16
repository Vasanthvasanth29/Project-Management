import React from 'react';
import { Plus, Inbox, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../common/Badges';
import { Avatar } from '../common/Avatar';
import { TaskTypeBadge } from '../../pages/shared/tasks/TaskTypeBadge';
import { IssueSection } from './IssueSection';
import { resolveIssueKey } from '../../utils/issueKeyResolver';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import { useAppStore } from '../../store/appStore';
import { getWorkItemLabel, type ChildIssueRow } from '../../utils/workItemHierarchy';

interface ChildIssueListProps {
  title: string;
  rows: ChildIssueRow[];
  onOpen: (taskId: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  emptyMessage?: string;
  defaultOpen?: boolean;
}

/**
 * Jira-style "Work Items in ..." table:
 *
 *   ISSUES IN EPIC   8/13 done · 62%                 Collapse
 *   [========progress bar=========]
 *   TYPE | ISSUE KEY | SUMMARY | STATUS | ASSIGNEE
 *
 * Counts, percentage and bar are always derived from the rows — never
 * hardcoded — and cancelled work never counts as done. Child rows keep their
 * parent-child indentation.
 */
export const ChildIssueList: React.FC<ChildIssueListProps> = ({
  title,
  rows,
  onOpen,
  onAdd,
  addLabel,
  emptyMessage = 'No child work items yet',
  defaultOpen = true,
}) => {
  const { users, projects } = useAppStore();

  const topLevel = rows.filter((r) => r.depth === 1);
  // Cancelled is a real terminal state — it must never count as "done".
  const completed = topLevel.filter(
    (r) => r.task.status === 'DONE' && !isCancelledWorkItem(r.task)
  ).length;
  const pct = topLevel.length > 0 ? Math.round((completed / topLevel.length) * 100) : 0;

  const meta =
    topLevel.length > 0 ? (
      <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 tabular-nums">
        {completed}/{topLevel.length} done · {pct}%
      </span>
    ) : null;

  const action = onAdd ? (
    <button type="button" onClick={onAdd} className="btn-primary btn-xs flex items-center gap-1">
      <Plus className="w-3.5 h-3.5" />
      <span>{addLabel || 'Add'}</span>
    </button>
  ) : undefined;

  return (
    <IssueSection title={title} meta={meta} action={action} defaultOpen={defaultOpen}>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Inbox className="w-7 h-7 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">{emptyMessage}</p>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f766e] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> {addLabel || 'Create the first one'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Dynamic progress bar directly under the section header */}
          {topLevel.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${pct === 100 ? 'bg-[#10b981]' : 'bg-[#0d9488]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Column header: type | issue key | summary | status | assignee */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <span className="w-[52px] flex-shrink-0">Type</span>
              <span className="w-[84px] flex-shrink-0">Issue Key</span>
              <span className="flex-1 min-w-0">Summary</span>
              <span className="w-[76px] flex-shrink-0">Status</span>
              <span className="w-[112px] flex-shrink-0 text-right hidden sm:inline">Assignee</span>
              <span className="w-3.5 flex-shrink-0" aria-hidden />
            </div>

            <div className="divide-y divide-slate-100">
              {rows.map(({ task: child, depth }) => {
                const project = projects.find((p) => p.id === child.projectId);
                const assignee = users.find((u) => u.id === child.assigneeId);
                const key = resolveIssueKey(project, child);
                const statusLabel = isCancelledWorkItem(child) ? 'Cancelled' : child.status;

                // Jira-style row: type | key | summary | status pill | assignee | hover action.
                return (
                  <button
                    type="button"
                    key={child.id}
                    onClick={() => onOpen(child.id)}
                    style={{ paddingLeft: `${12 + (depth - 1) * 20}px` }}
                    className={`group w-full text-left flex items-center gap-2.5 py-2 pr-3 hover:bg-[#f0fdfa] transition-colors text-xs cursor-pointer ${
                      depth > 1 ? 'bg-slate-50/60' : ''
                    }`}
                  >
                    <span
                      className="w-[52px] flex-shrink-0"
                      title={getWorkItemLabel(child.type)}
                    >
                      <TaskTypeBadge type={child.type} plain />
                    </span>

                    <span className="w-[84px] flex-shrink-0 font-mono text-[11px] font-semibold text-[#0f766e] hover:underline truncate">
                      {key}
                    </span>

                    <span
                      className="flex-1 min-w-0 truncate font-semibold text-slate-800 group-hover:text-[#0f766e]"
                      title={`${child.title} — ${statusLabel}`}
                    >
                      {depth > 1 && <span className="text-slate-300 mr-1">&#8230;</span>}
                      {child.title}
                    </span>

                    <span className="w-[76px] flex-shrink-0">
                      <StatusBadge status={child.status} resolution={child.resolution} />
                    </span>

                    <span className="w-[112px] flex-shrink-0 flex items-center justify-end gap-1.5 hidden sm:flex">
                      {assignee ? (
                        <>
                          <span className="text-[11px] text-slate-600 truncate max-w-[72px]">
                            {assignee.name}
                          </span>
                          <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                      )}
                    </span>

                    <ArrowRight
                      className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </IssueSection>
  );
};
