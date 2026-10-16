import React, { useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../../store/appStore';
import { formatDate } from '../../../utils/dateUtils';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import type { ChartDataPoint, Task } from '../../../types';

interface BurnupChartProps {
  projectId: string;
  sprintId: string;
}

export const BurnupChart: React.FC<BurnupChartProps> = ({ projectId, sprintId }) => {
  const { sprints, tasks } = useAppStore();
  const sprint = sprints.find((s) => s.id === sprintId);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!sprint) return [];

    const sprintTasks = collectSprintWorkItems({ sprintId: sprint.id, projectId });
    // Cancelled work is dropped from scope: it never completes, so it must not
    // inflate the scope line or the remaining count.
    const scopeTasks: Task[] = sprintTasks.filter((task) => !isCancelledWorkItem(task));
    const totalTasks = scopeTasks.length;
    if (totalTasks === 0) return [];

    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const today = new Date();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const data: ChartDataPoint[] = [];
    const donePerDay: Record<number, number> = {};

    scopeTasks.forEach((task) => {
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt);
        const dayOffset = Math.ceil((completedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayOffset >= 0 && dayOffset <= totalDays) {
          donePerDay[dayOffset] = (donePerDay[dayOffset] || 0) + 1;
        }
      }
    });

    let cumulativeDone = 0;

    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + day);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;

      if (donePerDay[day]) {
        cumulativeDone += donePerDay[day];
      }

      if (date <= today || day === totalDays) {
        data.push({
          day,
          label,
          scope: totalTasks,
          completed: cumulativeDone,
          remaining: totalTasks - cumulativeDone,
        });
      }
    }

    return data;
  }, [sprint, tasks]);

  if (!sprint) {
    return (
      <div className="card p-8 text-center">
        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-600">Iteration not found</h3>
      </div>
    );
  }

  const sprintTasks = collectSprintWorkItems({ sprintId: sprint.id, projectId });
  const scopeTasks = sprintTasks.filter((t) => !isCancelledWorkItem(t));
  const completedCount = scopeTasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <h2 className="text-sm font-bold text-[#1f1f1f] font-display">Burn Up Chart</h2>
            </div>
            <p className="text-xs text-[#747775]">{sprint.name} — {formatDate(sprint.startDate)} to {formatDate(sprint.endDate)}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[#747775]" />
              <span className="text-[#747775]">Scope</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[#34a853]" />
              <span className="text-[#747775]">Completed</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#747775]">
            <Calendar className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No burnup data available for this iteration.</p>
            <p className="text-[10px] mt-1">Add tasks to the iteration to see the burnup chart.</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
                  label={{ value: 'Tasks', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#747775' } }}
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
                <Area
                  type="monotone"
                  dataKey="scope"
                  stroke="#747775"
                  fill="#f1f3f4"
                  strokeWidth={2}
                  name="Total Scope"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#34a853"
                  fill="#e6f4ea"
                  strokeWidth={2}
                  name="Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <div className="text-lg font-bold text-[#1f1f1f]">{scopeTasks.length}</div>
            <div className="text-[10px] text-[#747775]">Total Scope</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <div className="text-lg font-bold text-emerald-700">{completedCount}</div>
            <div className="text-[10px] text-emerald-600">Completed</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <div className="text-lg font-bold text-blue-700">{scopeTasks.length - completedCount}</div>
            <div className="text-[10px] text-blue-600">Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};
