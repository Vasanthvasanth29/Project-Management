import React, { useMemo } from 'react';
import { FileText, Target, Calendar, CheckCircle2, Clock, AlertTriangle, ListTodo, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Gauge } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { ProgressBar } from '../../../components/common/ProgressBar';
import { formatDate } from '../../../utils/dateUtils';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import { BurndownPlot, buildBurndownSeries, burndownScope } from './BurndownChart';
import type { SprintStatus } from '../../../types';

interface SprintOption {
  id: string;
  name: string;
  status: SprintStatus;
}

interface SprintReportProps {
  projectId: string;
  sprintId: string;
  /** Project sprints for the report's own iteration selector. */
  sprintOptions?: SprintOption[];
  onSprintChange?: (sprintId: string) => void;
}

const SPRINT_STATUS_BADGE: Record<SprintStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
};

export const SprintReport: React.FC<SprintReportProps> = ({ projectId, sprintId, sprintOptions, onSprintChange }) => {
  const { sprints, users } = useAppStore();
  const sprint = sprints.find((s) => s.id === sprintId);

  // Store tasks + seed board issues, so a seed-only iteration reports real numbers.
  const sprintTasks = useMemo(
    () => (sprint ? collectSprintWorkItems({ sprintId: sprint.id, projectId }) : []),
    [sprint, projectId]
  );
  const chartData = useMemo(
    () => (sprint ? buildBurndownSeries(sprint, burndownScope(sprintTasks)) : []),
    [sprint, sprintTasks]
  );

  const isCancelled = (t: { status: string; resolution?: string }) => isCancelledWorkItem(t);
  const completedTasks = sprintTasks.filter((t) => t.status === 'DONE' && !isCancelled(t));
  const cancelledTasks = sprintTasks.filter(isCancelled);
  const inProgressTasks = sprintTasks.filter((t) =>
    t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING' || t.status === 'BUG_FIX'
  );
  const remainingTasks = sprintTasks.filter((t) =>
    t.status === 'TODO' || t.status === 'BLOCKED' || t.status === 'RETEST'
  );
  const blockedTasks = sprintTasks.filter((t) => t.status === 'BLOCKED');

  const totalEstimated = sprintTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalActual = sprintTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
  const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const completionPct = sprintTasks.length > 0 ? Math.round((completedTasks.length / sprintTasks.length) * 100) : 0;

  if (!sprint) {
    return (
      <div className="card p-8 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-600">Iteration not found</h3>
        <p className="text-xs text-slate-400 mt-1">Select an iteration to view its report.</p>
      </div>
    );
  }

  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const today = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.min(totalDays, Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  // "planned" marks dates that have not happened yet (or that the sprint is
  // still awaiting), exactly like Jira's sprint report.
  const startPlanned = startDate.getTime() > today.getTime();
  const endPlanned = endDate.getTime() > today.getTime() || sprint.status !== 'COMPLETED';
  const ownerName = users.find((u) => u.id === sprint.createdById)?.name || 'Unknown';
  // Scope added during the sprint (created after the sprint started) and
  // scope removed from it (cancelled/descoped work), both derived from state.
  const addedTasks = sprintTasks.filter(
    (t) => new Date(t.createdAt).getTime() > startDate.getTime()
  );
  const removedTasks = cancelledTasks;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Report Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <h2 className="text-lg font-bold text-[#1f1f1f] font-display">Iteration Report</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${SPRINT_STATUS_BADGE[sprint.status]}`}>
                {sprint.status}
              </span>
            </div>
            <p className="text-xs text-[#747775]">
              {sprint.name} — {formatDate(sprint.startDate)} to {formatDate(sprint.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {sprintOptions && onSprintChange && (
              <select
                aria-label="Select iteration for this report"
                value={sprint.id}
                onChange={(e) => onSprintChange(e.target.value)}
                className="input text-xs py-1.5"
              >
                {sprintOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.status})
                  </option>
                ))}
              </select>
            )}
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1f1f1f]">{completionPct}%</div>
              <div className="text-[10px] text-[#747775] uppercase tracking-wider">Complete</div>
            </div>
          </div>
        </div>

        <ProgressBar value={completionPct} height="lg" color="#1a73e8" />

        {/* Details — Jira's Started / Ended / by-user facts, derived from the sprint */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-4 text-xs text-[#747775]">
          <span>
            <strong className="text-[#1f1f1f]">Started:</strong>{' '}
            {formatDate(sprint.startDate)}{startPlanned ? ' (planned)' : ''}
          </span>
          <span>
            <strong className="text-[#1f1f1f]">Ended:</strong>{' '}
            {formatDate(sprint.endDate)}{endPlanned ? ' (planned)' : ''}
          </span>
          <span>
            <strong className="text-[#1f1f1f]">By:</strong> {ownerName}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#747775]" />
              <span className="text-[10px] text-[#747775] uppercase tracking-wider">Duration</span>
            </div>
            <div className="text-sm font-bold text-[#1f1f1f]">{totalDays} days</div>
            <div className="text-[10px] text-[#747775]">{daysElapsed} elapsed, {daysRemaining} remaining</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3.5 h-3.5 text-[#1a73e8]" />
              <span className="text-[10px] text-[#747775] uppercase tracking-wider">Iteration Goal</span>
            </div>
            <div className="text-xs font-semibold text-[#1f1f1f] line-clamp-2">{sprint.goal || 'No goal set'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#d97706]" />
              <span className="text-[10px] text-[#747775] uppercase tracking-wider">Hours</span>
            </div>
            <div className="text-sm font-bold text-[#1f1f1f]">{totalActual}h / {totalEstimated}h</div>
            <div className="text-[10px] text-[#747775]">actual / estimated</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <ListTodo className="w-3.5 h-3.5 text-[#059669]" />
              <span className="text-[10px] text-[#747775] uppercase tracking-wider">Tasks</span>
            </div>
            <div className="text-sm font-bold text-[#1f1f1f]">{sprintTasks.length} total</div>
            <div className="text-[10px] text-[#747775]">{completedTasks.length} completed</div>
          </div>
        </div>
      </div>

      {/* Burndown — same series maths as the standalone Burn Down Chart report */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1f1f1f] flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#1a73e8]" />
            Burn Down
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[#1a73e8]" />
              <span className="text-[#747775]">Ideal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[#ea4335]" />
              <span className="text-[#747775]">Actual</span>
            </div>
          </div>
        </div>
        <BurndownPlot chartData={chartData} />
      </div>

      {/* Summary Section for PM */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-[#1f1f1f] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#1a73e8]" />
          Summary for Project Manager
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#747775] uppercase tracking-wider">Work Summary</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-800">Completed</span>
                </div>
                <span className="text-sm font-bold text-emerald-900">{completedTasks.length} tasks</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-800">In Progress</span>
                </div>
                <span className="text-sm font-bold text-blue-900">{inProgressTasks.length} tasks</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800">Remaining</span>
                </div>
                <span className="text-sm font-bold text-amber-900">{remainingTasks.length} tasks</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-violet-50 border border-violet-100">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-semibold text-violet-800">Added</span>
                </div>
                <span className="text-sm font-bold text-violet-900">{addedTasks.length} tasks</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <MinusCircle className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">Removed / scope changes</span>
                </div>
                <span className="text-sm font-bold text-slate-700">
                  {removedTasks.length} tasks
                  {removedTasks.length > 0 && (
                    <span className="ml-1 text-[10px] font-medium">cancelled from scope</span>
                  )}
                </span>
              </div>
              {blockedTasks.length > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-800">Blocked</span>
                  </div>
                  <span className="text-sm font-bold text-red-900">{blockedTasks.length} tasks</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#747775] uppercase tracking-wider">Velocity Indicators</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-xs text-[#747775] mb-1">Completion Rate</div>
                <div className="text-lg font-bold text-[#1f1f1f]">{completionPct}%</div>
                <ProgressBar value={completionPct} height="sm" color="#1a73e8" />
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-xs text-[#747775] mb-1">Planned vs Completed</div>
                <div className="text-lg font-bold text-[#1f1f1f]">
                  {completedTasks.length} / {sprintTasks.length}
                </div>
                <div className="text-[10px] text-[#747775]">completed / planned</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[#747775]">Velocity</div>
                  <Gauge className="w-3.5 h-3.5 text-[#747775]" />
                </div>
                <div className="text-lg font-bold text-[#1f1f1f]">{completedPoints} pts</div>
                <div className="text-[10px] text-[#747775]">story points completed this iteration</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Breakdown */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-[#1f1f1f] mb-4">Task Breakdown</h3>
        {sprintTasks.length === 0 ? (
          <div className="text-center py-8 text-[#747775]">
            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No tasks in this iteration yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e0e2ec]">
                  <th className="text-left py-2 px-3 font-bold text-[#747775]">Task</th>
                  <th className="text-left py-2 px-3 font-bold text-[#747775]">Status</th>
                  <th className="text-left py-2 px-3 font-bold text-[#747775]">Priority</th>
                  <th className="text-right py-2 px-3 font-bold text-[#747775]">Est.</th>
                  <th className="text-right py-2 px-3 font-bold text-[#747775]">Actual</th>
                </tr>
              </thead>
              <tbody>
                {sprintTasks.map((task) => (
                  <tr key={task.id} className="border-b border-[#f1f3f4] hover:bg-[#f8fafd]">
                    <td className="py-2 px-3">
                      <div className="font-semibold text-[#1f1f1f] truncate max-w-[250px]">{task.title}</div>
                      <div className="text-[10px] text-[#747775]">{task.issueKey || task.id}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCancelled(task) ? 'bg-slate-200 text-slate-600' :
                        task.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {isCancelled(task) ? 'CANCELLED' : task.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        task.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-[#747775]">{task.estimatedHours || '-'}h</td>
                    <td className="py-2 px-3 text-right text-[#747775]">{task.actualHours || '-'}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
