import React from 'react';
import type { Activity } from '../../types';
import { useAppStore } from '../../store/appStore';
import { Avatar } from './Avatar';
import { formatTimeAgo, formatDate } from '../../utils/dateUtils';
import { FolderKanban, Activity as ActivityIcon } from 'lucide-react';

interface ActivityFeedProps {
  activities: Activity[];
  limit?: number;
  showDate?: boolean;
  showProjectBadge?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  limit = 20,
  showDate = true,
  showProjectBadge = true,
}) => {
  const { users, projects, tasks, bugs, sprints } = useAppStore();

  const displayActivities = activities.slice(0, limit);

  const getUserById = (id: string) => users.find((u) => u.id === id);

  const getProjectForActivity = (act: Activity) => {
    let projId = act.projectId;
    if (!projId) {
      if (act.entityType === 'PROJECT') projId = act.entityId;
      else if (act.entityType === 'TASK') projId = tasks.find((t) => t.id === act.entityId)?.projectId;
      else if (act.entityType === 'BUG') projId = bugs.find((b) => b.id === act.entityId)?.projectId;
      else if (act.entityType === 'SPRINT') projId = sprints.find((s) => s.id === act.entityId)?.projectId;
    }
    return projects.find((p) => p.id === projId);
  };

  // Group by date
  const grouped = displayActivities.reduce<Record<string, Activity[]>>((acc, act) => {
    const dateKey = formatDate(act.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(act);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {Object.entries(grouped).map(([date, acts]) => (
        <div key={date}>
          {showDate && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#f1f5f9]" />
              <span className="text-xs font-medium text-[#9ca3af] px-2">{date}</span>
              <div className="flex-1 h-px bg-[#f1f5f9]" />
            </div>
          )}
          <div className="space-y-1">
            {acts.map((act) => {
              const user = getUserById(act.userId);
              const project = getProjectForActivity(act);

              return (
                <div key={act.id} className="flex items-start gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 transition-colors group">
                  {user ? (
                    <Avatar name={user.name} color={user.avatarColor} size="sm" className="mt-0.5 flex-shrink-0" />
                  ) : (
                    <Avatar name="Unknown" color="#9ca3af" size="sm" className="mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm text-slate-700 leading-snug">
                        <span className="font-semibold text-slate-900">{user?.name || 'Unknown User'}</span>
                        {' '}{act.action}{' '}
                        <span className="font-semibold text-brand-700">{act.entityTitle}</span>
                      </p>
                      {showProjectBadge && project && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold badge-teal flex-shrink-0">
                          <FolderKanban className="w-3 h-3" />
                          {project.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(act.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {displayActivities.length === 0 && (
        <div className="text-center py-10 text-[#9ca3af] text-sm">
          <ActivityIcon className="w-8 h-8 mx-auto mb-2 text-[#e2e8f0]" />
          No activity recorded for this criteria
        </div>
      )}
    </div>
  );
};

