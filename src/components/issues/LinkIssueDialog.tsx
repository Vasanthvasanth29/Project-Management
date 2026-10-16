import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DependencyType, Task } from '../../types';
import { useAppStore } from '../../store/appStore';
import { RichTextEditor } from '../common/RichTextEditor';
import { StatusBadge } from '../common/Badges';
import { TaskTypeBadge } from '../../pages/shared/tasks/TaskTypeBadge';
import {
  resolveIssueKey,
  resolveTaskByIssueKey,
  searchIssues,
  type IssueSearchHit,
} from '../../utils/issueKeyResolver';
import { ISSUE_LINK_TYPE_OPTIONS, ISSUE_LINK_LABEL, isDuplicateLink } from '../../utils/issueLinks';
import { buildProjectTeamMembers } from '../../utils/sprintIssues';

interface LinkIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The issue the dialog is opened from ("This issue"). */
  task: Task;
}

/**
 * Jira-style "Link" dialog — issue-to-issue links only (no Confluence, no web
 * links). One relationship record is created; the other side derives its own
 * label from it, so both pages always agree.
 */
export const LinkIssueDialog: React.FC<LinkIssueDialogProps> = ({ isOpen, onClose, task }) => {
  const { tasks, projects, sprints, taskDependencies, addTaskDependency, teams, users } = useAppStore();

  const mentionableUsers = useMemo(() => {
    const project = projects.find((p) => p.id === task.projectId);
    return project ? buildProjectTeamMembers(project, teams, users) : users;
  }, [projects, teams, users, task.projectId]);

  const [relationship, setRelationship] = useState<DependencyType>('BLOCKS');
  const [selected, setSelected] = useState<Task | null>(null);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [commentHtml, setCommentHtml] = useState('');
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRelationship('BLOCKS');
      setSelected(null);
      setQuery('');
      setShowResults(false);
      setCommentHtml('');
      setError('');
    }
  }, [isOpen]);

  // Close the result list on outside click
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const keyOf = (t: Task): string =>
    resolveIssueKey(projects.find((p) => p.id === t.projectId), t);

  // Searches by real issue key OR title across every project — existing tasks
  // plus board issues that were never opened (they are materialised on select).
  const results = useMemo(() => {
    const needle = query.trim();
    return searchIssues(needle)
      .sort((a, b) => {
        const sameProject =
          Number(b.projectId === task.projectId) - Number(a.projectId === task.projectId);
        if (sameProject !== 0) return sameProject;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, task.projectId, tasks, projects, sprints]);

  const selectedKey = selected ? keyOf(selected) : '';

  const selectIssue = (hit: IssueSearchHit) => {
    const target = hit.task || resolveTaskByIssueKey(hit.key)?.task;
    if (!target) {
      setError('That issue could not be found.');
      return;
    }
    setSelected(target);
    setShowResults(false);
    setQuery('');
    setError(target.id === task.id ? 'An issue cannot be linked to itself.' : '');
  };

  const focusSearch = () => {
    setSelected(null);
    setError('');
    setShowResults(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selected) {
      setError('Select an issue to link this issue to.');
      return;
    }
    if (selected.id === task.id) {
      setError('An issue cannot be linked to itself.');
      return;
    }
    if (isDuplicateLink(taskDependencies, task.id, selected.id, relationship)) {
      setError('This relationship already exists.');
      return;
    }

    const created = addTaskDependency(task.id, selected.id, relationship, commentHtml);
    if (!created) {
      setError('This relationship already exists.');
      return;
    }

    toast.success(`Linked ${keyOf(selected)} — ${ISSUE_LINK_LABEL[relationship]}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-modal border border-slate-200 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Link"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200">
              <Link2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">Link</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Single source mode — issues only */}
          <div className="flex items-center gap-2">
            <span
              role="tab"
              aria-selected="true"
              className="inline-flex items-center rounded-t-lg border border-b-0 border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
            >
              Issue
            </span>
          </div>

          <p className="text-xs text-slate-500">Select an issue to link this issue to</p>

          {/* Relationship */}
          <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
            <label htmlFor="link-relationship" className="text-xs font-bold text-slate-700">
              This issue
            </label>
            <select
              id="link-relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as DependencyType)}
              className="input bg-white text-sm py-2"
            >
              {ISSUE_LINK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Issue selector */}
          <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-start gap-2">
            <label htmlFor="link-issue-search" className="text-xs font-bold text-slate-700 pt-2">
              Issue
            </label>
            <div className="relative min-w-0" ref={wrapRef}>
              {selected ? (
                <div className="input bg-white py-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#0052cc] truncate">
                    {selectedKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setError('');
                      requestAnimationFrame(() => searchRef.current?.focus());
                    }}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                    aria-label="Remove selected issue"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <input
                      id="link-issue-search"
                      ref={searchRef}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setShowResults(true);
                        setError('');
                      }}
                      onFocus={() => setShowResults(true)}
                      placeholder="Select/search issue"
                      className="input bg-white text-sm py-2 pr-8"
                      autoComplete="off"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {showResults && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-fe-md z-20">
                      {results.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-slate-400">No work items found.</p>
                      ) : (
                        results.map((hit) => (
                          <button
                            key={`${hit.projectId}|${hit.key}`}
                            type="button"
                            onClick={() => selectIssue(hit)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                          >
                            <TaskTypeBadge type={hit.type as Task['type']} plain />
                            <span className="font-mono text-[11px] font-semibold text-[#0052cc] flex-shrink-0">
                              {hit.key}
                            </span>
                            <span className="text-xs text-slate-700 truncate flex-1">{hit.title}</span>
                            <span className="text-[10px] flex-shrink-0">
                              <StatusBadge status={hit.status} resolution={hit.resolution} />
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={focusSearch}
            className="text-xs text-[#0052cc] hover:underline sm:ml-[118px]"
          >
            or search for an issue
          </button>

          {/* Comment */}
          <div>
            <label
              htmlFor="link-comment"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Comment
            </label>
            <div id="link-comment">
              <RichTextEditor
                content={commentHtml}
                onChange={setCommentHtml}
                placeholder="Add a comment about this link (optional)..."
                minHeight="72px"
                mentionableUsers={mentionableUsers}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="submit" className="btn-primary btn-sm">
              Link
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
