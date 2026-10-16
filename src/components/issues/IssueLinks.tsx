import React, { useEffect, useMemo, useState } from 'react';
import type { Task, DependencyType } from '../../types';
import { Link2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { TaskTypeBadge } from '../../pages/shared/tasks/TaskTypeBadge';
import { StatusBadge } from '../common/Badges';
import { IssueSection } from './IssueSection';
import { LinkIssueDialog } from './LinkIssueDialog';
import { resolveIssueKey } from '../../utils/issueKeyResolver';
import {
  ISSUE_LINK_DOT_COLOR,
  ISSUE_LINK_LABEL,
  ISSUE_LINK_TYPE_OPTIONS,
  perspectiveLinkType,
} from '../../utils/issueLinks';

interface LinkEntry {
  dependencyId: string;
  target: Task;
  /** Relationship as seen from the issue rendered on this page. */
  type: DependencyType;
}

interface IssueLinksProps {
  task: Task;
  onOpen: (taskId: string) => void;
  defaultOpen?: boolean;
}

/**
 * Jira-style "Related Work Items": one stored relationship per link, rendered from
 * the current issue's point of view (`A blocks B` shows "blocks" on A and
 * "is blocked by" on B). Keys come from the shared issue-key resolver, so the
 * row always shows the issue's real, clickable Jira-style key.
 */
export const IssueLinks: React.FC<IssueLinksProps> = ({ task, onOpen, defaultOpen = true }) => {
  const { tasks, taskDependencies, removeTaskDependency, projects, rehydrateIssueLinks } =
    useAppStore();
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Links created in an earlier session are stored by issue key; re-bind them
  // to the Tasks that exist now (materialising board issues on demand).
  useEffect(() => {
    rehydrateIssueLinks();
  }, [rehydrateIssueLinks, taskDependencies, tasks]);

  const groups = useMemo(() => {
    const byLabel = new Map<string, LinkEntry[]>();

    taskDependencies.forEach((dep) => {
      let target: Task | undefined;
      if (dep.taskId === task.id) target = tasks.find((t) => t.id === dep.dependsOnTaskId);
      else if (dep.dependsOnTaskId === task.id) target = tasks.find((t) => t.id === dep.taskId);
      if (!target) return;

      const type = perspectiveLinkType(dep.type, dep.taskId, task.id);
      const label = ISSUE_LINK_LABEL[type];
      const list = byLabel.get(label) || [];
      list.push({ dependencyId: dep.id, target, type });
      byLabel.set(label, list);
    });

    return ISSUE_LINK_TYPE_OPTIONS.filter((option) => byLabel.has(option.label)).map(
      (option) => [option.label, byLabel.get(option.label) || []] as [string, LinkEntry[]]
    );
  }, [tasks, taskDependencies, task.id]);

  const total = groups.reduce((sum, [, entries]) => sum + entries.length, 0);

  const handleRemove = (dependencyId: string) => {
    removeTaskDependency(dependencyId);
    toast.success('Issue link removed');
  };

  const keyOf = (target: Task): string =>
    resolveIssueKey(projects.find((p) => p.id === target.projectId), target);

  return (
    <>
      <IssueSection
        title="Related Work Items"
        icon={<Link2 className="w-3.5 h-3.5 text-[#0d9488]" />}
        meta={
          <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
            {total}
          </span>
        }
        action={
          <button
            type="button"
            onClick={() => setShowLinkDialog(true)}
            className="btn-secondary btn-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add link
          </button>
        }
        defaultOpen={defaultOpen}
      >
        {total === 0 ? (
          <p className="text-xs text-slate-400 py-2">No related work items yet.</p>
        ) : (
          <div className="space-y-3">
            {groups.map(([label, entries]) => (
              <div key={label} className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 tracking-wide">
                  <span className={`w-2 h-2 rounded-full ${ISSUE_LINK_DOT_COLOR[label] || 'bg-slate-400'}`} />
                  {label}
                </h4>
                <div className="divide-y rounded-lg border overflow-hidden border-slate-200 bg-slate-50/60">
                  {entries.map(({ dependencyId, target }) => (
                    <div
                      key={dependencyId}
                      className="px-3 py-2 bg-white/70 text-xs flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(target.id)}
                        className="flex items-center gap-2 min-w-0 text-left hover:underline"
                      >
                        <TaskTypeBadge type={target.type} plain />
                        <span className="font-mono text-[10px] text-slate-500 flex-shrink-0">
                          {keyOf(target)}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{target.title}</span>
                      </button>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-slate-300" aria-hidden="true">
                          =
                        </span>
                        <StatusBadge status={target.status} resolution={target.resolution} />
                        <button
                          type="button"
                          onClick={() => handleRemove(dependencyId)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white"
                          title="Remove link"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </IssueSection>

      <LinkIssueDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        task={task}
      />
    </>
  );
};
