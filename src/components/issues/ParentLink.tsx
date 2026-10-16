import React from 'react';
import type { Task } from '../../types';
import { resolveIssueKey } from '../../utils/issueKeyResolver';
import { useAppStore } from '../../store/appStore';

interface ParentLinkProps {
  parent?: Task;
  onOpen?: (taskId: string) => void;
  /** Show the parent's issue key next to the title */
  showKey?: boolean;
}

/**
 * Jira-style parent/epic reference row: `KEY Title`.
 *
 * Only the issue key is a hyperlink (opens `/browse/{key}`); the title is plain
 * text and the row is a simple inline flex line — no pill, card or icon.
 *
 * The key always comes from the single resolver `resolveIssueKey`, so it is the
 * parent's own real Jira key — never a key derived from an internal Task id.
 */
export const ParentLink: React.FC<ParentLinkProps> = ({ parent, onOpen, showKey = true }) => {
  const projects = useAppStore((s) => s.projects);

  if (!parent) {
    return <span className="text-slate-400 font-normal italic">None</span>;
  }

  const parentProject = projects.find((p) => p.id === parent.projectId);
  const key = resolveIssueKey(parentProject, parent);

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full overflow-hidden">
      {showKey && (
        <button
          type="button"
          onClick={() => onOpen?.(parent.id)}
          className="font-mono font-semibold text-[#0052cc] hover:text-[#0747a6] hover:underline cursor-pointer shrink-0"
          title={`Open ${key}`}
        >
          {key}
        </button>
      )}
      {/* One line only: never wraps; ellipsis only when the row cannot fit. */}
      <span className="font-normal text-slate-800 min-w-0 truncate">{parent.title}</span>
    </span>
  );
};
