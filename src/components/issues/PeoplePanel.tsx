import React from 'react';
import type { Task } from '../../types';
import { ThumbsUp, Eye, Users, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../common/Avatar';
import { IssueSection } from './IssueSection';
import { IssueField } from './IssueField';

interface PeoplePanelProps {
  task: Task;
  defaultOpen?: boolean;
}

/** Assignee / Reporter / Team / Votes / Watchers for an issue. */
export const PeoplePanel: React.FC<PeoplePanelProps> = ({ task, defaultOpen = true }) => {
  const { users, teams, updateTask } = useAppStore();
  const { currentUser } = useAuthStore();

  const assignee = users.find((u) => u.id === task.assigneeId);
  const reporter = users.find((u) => u.id === (task.reporterId || task.createdById));
  const team = teams.find((t) => t.id === task.teamId);

  const voterIds = task.voterIds || [];
  const watcherIds = task.watcherIds || [];
  const hasVoted = currentUser ? voterIds.includes(currentUser.id) : false;
  const isWatching = currentUser ? watcherIds.includes(currentUser.id) : false;

  const handleVote = () => {
    if (!currentUser) return;
    const next = hasVoted ? voterIds.filter((id) => id !== currentUser.id) : [...voterIds, currentUser.id];
    updateTask(task.id, { voterIds: next });
    toast.success(hasVoted ? 'Vote removed' : 'Vote recorded');
  };

  const handleWatch = () => {
    if (!currentUser) return;
    const next = isWatching ? watcherIds.filter((id) => id !== currentUser.id) : [...watcherIds, currentUser.id];
    updateTask(task.id, { watcherIds: next });
    toast.success(isWatching ? 'You are no longer watching this issue' : 'You are now watching this issue');
  };

  const person = (user: typeof assignee, fallback: string) =>
    user ? (
      <span className="inline-flex items-center gap-2 min-w-0">
        <Avatar name={user.name} color={user.avatarColor} size="sm" />
        <span className="font-semibold text-slate-800 truncate">{user.name}</span>
      </span>
    ) : (
      <span className="text-slate-400 font-normal italic">{fallback}</span>
    );

  return (
    <IssueSection
      title="People"
      icon={<Users className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      bodyClassName="space-y-3"
    >
      <IssueField label="Assignee">{person(assignee, 'Unassigned')}</IssueField>
      <IssueField label="Reporter">{person(reporter, 'Unknown')}</IssueField>

      {(task.type !== 'INITIATIVE' && (team || task.teamName)) && (
        <IssueField label="Team">
          {team ? (
            <span className="inline-flex items-center gap-2 min-w-0">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: team.color || '#0d9488' }}
              >
                {team.name.charAt(0)}
              </span>
              <span className="truncate">{task.teamName || team.name}</span>
            </span>
          ) : (
            task.teamName
          )}
        </IssueField>
      )}

      <div className="pt-1 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Votes</span>
          <button
            type="button"
            onClick={handleVote}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              hasVoted
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}
            title={hasVoted ? 'Remove your vote' : 'Vote for this issue'}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{voterIds.length}</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Watchers</span>
            <button
              type="button"
              onClick={handleWatch}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                isWatching
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600'
              }`}
              title={isWatching ? 'Stop watching' : 'Watch this issue'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isWatching ? 'Watching' : 'Watch'}</span>
            </button>
          </div>

          {watcherIds.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {watcherIds.slice(0, 6).map((id) => {
                const watcher = users.find((u) => u.id === id);
                return watcher ? (
                  <Avatar key={id} name={watcher.name} color={watcher.avatarColor} size="xs" />
                ) : null;
              })}
              <span className="text-[10px] text-slate-400 ml-1">
                {watcherIds.length} watching
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <UserIcon className="w-3 h-3" /> No one is watching yet
            </p>
          )}
        </div>
      </div>
    </IssueSection>
  );
};
