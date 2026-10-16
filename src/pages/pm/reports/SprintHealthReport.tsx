import React, { useMemo } from 'react';
import { Zap, CheckCircle, Clock, AlertTriangle, Target } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { StatusBadge } from '../../../components/common/Badges';
import { formatDate } from '../../../utils/dateUtils';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';

interface SprintHealthProps {
  projectId: string;
  sprintId: string;
}

export const SprintHealthReport: React.FC<SprintHealthProps> = ({ projectId, sprintId }) => {
  const { sprints, tasks, users, releases } = useAppStore();

  const sprint = sprints.find((s) => s.id === sprintId);
  // Store tasks + seed board issues so seed-only iterations report real health.
  const sprintTasks = useMemo(
    () => collectSprintWorkItems({ sprintId, projectId }),
    [tasks, sprintId, projectId]
  );

  const stats = useMemo(() => {
    const total = sprintTasks.length;
    const isDone = (t: { status: string; resolution?: string }) =>
      t.status === 'DONE' && !isCancelledWorkItem(t);
    const done = sprintTasks.filter(isDone).length;
    const inProgress = sprintTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING').length;
    const blocked = sprintTasks.filter((t) => t.status === 'BLOCKED').length;
    const todo = sprintTasks.filter((t) => t.status === 'TODO').length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = sprintTasks.filter(isDone).reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const totalHours = sprintTasks.reduce((sum, t) => sum + (t.originalEstimate || t.estimatedHours || 0), 0);
    const loggedHours = sprintTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

    const today = new Date();
    const endDate = sprint ? new Date(sprint.endDate) : new Date();
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    return { total, done, inProgress, blocked, todo, completionPct, totalPoints, completedPoints, totalHours, loggedHours, daysLeft };
  }, [sprintTasks, sprint]);

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sprintTasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'DONE');
  }, [sprintTasks]);

  if (!sprint) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-600">Iteration not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Iteration Health: {sprint.name}</h2>
            <p className="text-xs text-slate-500">{formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}</p>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.completionPct}%</div>
            <div className="text-[10px] text-blue-600 font-medium mt-1">Completion</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.completedPoints}/{stats.totalPoints}</div>
            <div className="text-[10px] text-green-600 font-medium mt-1">Story Points</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.daysLeft}</div>
            <div className="text-[10px] text-purple-600 font-medium mt-1">Days Left</div>
          </div>
          <div className={`rounded-xl p-4 text-center ${stats.blocked > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <div className={`text-2xl font-bold ${stats.blocked > 0 ? 'text-red-700' : 'text-slate-700'}`}>{stats.blocked}</div>
            <div className={`text-[10px] font-medium mt-1 ${stats.blocked > 0 ? 'text-red-600' : 'text-slate-500'}`}>Blocked</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">Iteration Progress</span>
            <span className="text-xs font-bold text-slate-800">{stats.done}/{stats.total} tasks</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'To Do', count: stats.todo, color: 'bg-slate-100 text-slate-700' },
            { label: 'In Progress', count: stats.inProgress, color: 'bg-blue-100 text-blue-700' },
            { label: 'Done', count: stats.done, color: 'bg-green-100 text-green-700' },
            { label: 'Blocked', count: stats.blocked, color: 'bg-red-100 text-red-700' },
            { label: 'Overdue', count: overdueTasks.length, color: 'bg-orange-100 text-orange-700' },
          ].map((item) => (
            <div key={item.label} className={`${item.color} rounded-lg p-3 text-center`}>
              <div className="text-lg font-bold">{item.count}</div>
              <div className="text-[10px] font-medium">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Time Tracking */}
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Time Tracking</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Estimated Hours:</span>{' '}
              <span className="font-semibold text-slate-800">{stats.totalHours}h</span>
            </div>
            <div>
              <span className="text-slate-500">Logged Hours:</span>{' '}
              <span className="font-semibold text-slate-800">{stats.loggedHours}h</span>
            </div>
          </div>
          {stats.totalHours > 0 && (
            <div className="mt-2">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${stats.loggedHours > stats.totalHours ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, (stats.loggedHours / stats.totalHours) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="border-t border-slate-100 pt-4 mt-4">
            <h4 className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Overdue Tasks ({overdueTasks.length})
            </h4>
            <div className="divide-y divide-slate-100 rounded-lg border border-red-100 overflow-hidden">
              {overdueTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="px-3 py-2 bg-red-50/50 text-xs flex items-center justify-between">
                  <span className="font-semibold text-red-800">{t.title}</span>
                  <span className="text-red-500">Due {formatDate(t.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};