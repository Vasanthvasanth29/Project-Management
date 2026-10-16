import React, { useMemo } from 'react';
import { TrendingDown, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../../store/appStore';
import { formatDate } from '../../../utils/dateUtils';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import type { ChartDataPoint, Sprint, Task } from '../../../types';

interface BurndownChartProps {
  projectId: string;
  sprintId: string;
}

// Cancelled work leaves the burndown scope entirely: it is neither remaining
// work (it will never be finished) nor completed work (it was dropped).
export const burndownScope = (tasks: Task[]): Task[] =>
  tasks.filter((task) => !isCancelledWorkItem(task));

// Ideal + actual remaining series for one sprint. Exported so the Iteration
// Report can embed the exact same plot instead of duplicating the maths.
export const buildBurndownSeries = (
  sprint: Sprint,
  scopeTasks: Task[]
): ChartDataPoint[] => {
  const totalTasks = scopeTasks.length;
  if (totalTasks === 0) return [];

  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const today = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const data: ChartDataPoint[] = [];
  const donePerDay: Record<number, number> = {};

  // Count tasks completed per day offset
  scopeTasks.forEach((task) => {
    if (task.completedAt) {
      const completedDate = new Date(task.completedAt);
      const dayOffset = Math.ceil((completedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayOffset >= 0 && dayOffset <= totalDays) {
        donePerDay[dayOffset] = (donePerDay[dayOffset] || 0) + 1;
      }
    }
  });

  let actualRemaining = totalTasks;
  let cumulativeDone = 0;

  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;

    if (donePerDay[day]) {
      cumulativeDone += donePerDay[day];
    }
    actualRemaining = totalTasks - cumulativeDone;

    const idealRemaining = Math.round(totalTasks * (1 - day / totalDays));

    // Only include data up to today or end of sprint
    if (date <= today || day === totalDays) {
      data.push({
        day,
        label,
        ideal: idealRemaining,
        actual: actualRemaining,
      });
    }
  }

  return data;
};

// Chart-only plot (no card chrome) so the Iteration Report can embed it.
export const BurndownPlot: React.FC<{ chartData: ChartDataPoint[] }> = ({ chartData }) => {
  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-[#747775]">
        <Calendar className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">No burndown data available for this iteration.</p>
        <p className="text-[10px] mt-1">Add tasks to the iteration to see the burndown chart.</p>
      </div>
    );
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e2ec" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#747775' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e2ec' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#747775' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e2ec' }}
            allowDecimals={false}
            label={{ value: 'Remaining Tasks', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#747775' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#1a73e8"
            strokeWidth={2}
            strokeDasharray="8 4"
            dot={false}
            name="Ideal Remaining"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#ea4335"
            strokeWidth={2}
            dot={{ r: 3, fill: '#ea4335' }}
            activeDot={{ r: 5 }}
            name="Actual Remaining"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BurndownChart: React.FC<BurndownChartProps> = ({ projectId, sprintId }) => {
  const { sprints } = useAppStore();
  const sprint = sprints.find((s) => s.id === sprintId);

  const sprintTasks = useMemo(
    () => (sprint ? collectSprintWorkItems({ sprintId: sprint.id, projectId }) : []),
    [sprint, projectId]
  );
  const scopeTasks = useMemo(() => burndownScope(sprintTasks), [sprintTasks]);
  const chartData = useMemo(
    () => (sprint ? buildBurndownSeries(sprint, scopeTasks) : []),
    [sprint, scopeTasks]
  );
  const completedCount = useMemo(
    () => scopeTasks.filter((t) => t.status === 'DONE').length,
    [scopeTasks]
  );

  if (!sprint) {
    return (
      <div className="card p-8 text-center">
        <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-600">Iteration not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <h2 className="text-sm font-bold text-[#1f1f1f] font-display">Burn Down Chart</h2>
            </div>
            <p className="text-xs text-[#747775]">{sprint.name} — {formatDate(sprint.startDate)} to {formatDate(sprint.endDate)}</p>
          </div>
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

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <div className="text-lg font-bold text-[#1f1f1f]">{scopeTasks.length}</div>
            <div className="text-[10px] text-[#747775]">Total Tasks</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <div className="text-lg font-bold text-emerald-700">{completedCount}</div>
            <div className="text-[10px] text-emerald-600">Completed</div>
          </div>
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-center">
            <div className="text-lg font-bold text-red-700">{scopeTasks.length - completedCount}</div>
            <div className="text-[10px] text-red-600">Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};
