import React, { useMemo } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAppStore } from '../../../store/appStore';
import { formatDate } from '../../../utils/dateUtils';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import type { VelocityData } from '../../../types';

interface VelocityReportProps {
  projectId: string;
}

export const VelocityReport: React.FC<VelocityReportProps> = ({ projectId }) => {
  const { sprints, tasks } = useAppStore();

  const projectSprints = useMemo(() => {
    return sprints
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [sprints, projectId]);

  const velocityData = useMemo((): VelocityData[] => {
    return projectSprints.map((sprint) => {
      const sprintTasks = collectSprintWorkItems({ sprintId: sprint.id, projectId });
      // Cancelled work leaves both sides of the ratio: it is not planned scope
      // anymore and never counts as completed.
      const scopeTasks = sprintTasks.filter((t) => !isCancelledWorkItem(t));
      const completedTasks = scopeTasks.filter((t) => t.status === 'DONE');
      const plannedPoints = scopeTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        plannedTasks: scopeTasks.length,
        completedTasks: completedTasks.length,
        plannedPoints,
        completedPoints,
        velocity: plannedPoints > 0 ? completedPoints : completedTasks.length,
      };
    });
  }, [projectSprints, tasks, projectId]);

  // One unit for the whole chart: points when the project estimates in points,
  // otherwise task counts — bars, average line and table always agree.
  const usesPoints = velocityData.some((v) => v.plannedPoints > 0);
  const unitLabel = usesPoints ? 'Story Points' : 'Tasks';
  const chartData = useMemo(
    () =>
      velocityData.map((v) => ({
        ...v,
        planned: usesPoints ? v.plannedPoints : v.plannedTasks,
        completed: usesPoints ? v.completedPoints : v.completedTasks,
        velocity: usesPoints ? v.completedPoints : v.completedTasks,
      })),
    [velocityData, usesPoints]
  );

  const averageVelocity = useMemo(() => {
    if (chartData.length === 0) return 0;
    const completedSprints = chartData.filter((v) => v.planned > 0);
    if (completedSprints.length === 0) return 0;
    const total = completedSprints.reduce((sum, v) => sum + v.velocity, 0);
    return Math.round(total / completedSprints.length);
  }, [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return 'stable';
    const recent = chartData.slice(-2);
    if (recent[1].velocity > recent[0].velocity) return 'increasing';
    if (recent[1].velocity < recent[0].velocity) return 'decreasing';
    return 'stable';
  }, [chartData]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <h2 className="text-sm font-bold text-[#1f1f1f] font-display">Velocity Chart</h2>
            </div>
            <p className="text-xs text-[#747775]">Historical iteration performance and trends — measured in {unitLabel.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-[#1f1f1f]">{averageVelocity}</div>
              <div className="text-[10px] text-[#747775]">Avg Velocity</div>
            </div>
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
              trend === 'increasing' ? 'bg-emerald-100 text-emerald-700' :
              trend === 'decreasing' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              <TrendingUp className={`w-3.5 h-3.5 ${trend === 'decreasing' ? 'rotate-180' : ''}`} />
              {trend === 'increasing' ? 'Upward' : trend === 'decreasing' ? 'Downward' : 'Stable'}
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#747775]">
            <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No iteration data available for velocity calculation.</p>
            <p className="text-[10px] mt-1">Complete at least one iteration to see velocity trends.</p>
          </div>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e2ec" />
                  <XAxis
                    dataKey="sprintName"
                    tick={{ fontSize: 10, fill: '#747775' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e2ec' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#747775' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e2ec' }}
                    allowDecimals={false}
                    label={{ value: unitLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#747775' } }}
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
                  <ReferenceLine
                    y={averageVelocity}
                    stroke="#1a73e8"
                    strokeDasharray="5 5"
                    label={{ value: `Avg: ${averageVelocity}`, position: 'right', style: { fontSize: 10, fill: '#1a73e8' } }}
                  />
                  <Bar dataKey="planned" fill="#e0e2ec" name={`Planned (${unitLabel})`} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="#1a73e8" name={`Completed (${unitLabel})`} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Velocity Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e0e2ec]">
                    <th className="text-left py-2 px-3 font-bold text-[#747775]">Iteration</th>
                    <th className="text-left py-2 px-3 font-bold text-[#747775]">Dates</th>
                    <th className="text-right py-2 px-3 font-bold text-[#747775]">Planned ({usesPoints ? 'Pts' : 'Tasks'})</th>
                    <th className="text-right py-2 px-3 font-bold text-[#747775]">Completed ({usesPoints ? 'Pts' : 'Tasks'})</th>
                    <th className="text-right py-2 px-3 font-bold text-[#747775]">Velocity</th>
                    <th className="text-right py-2 px-3 font-bold text-[#747775]">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((v) => {
                    const sprint = projectSprints.find((s) => s.id === v.sprintId);
                    const completionPct = v.planned > 0 ? Math.round((v.completed / v.planned) * 100) : 0;
                    return (
                      <tr key={v.sprintId} className="border-b border-[#f1f3f4] hover:bg-[#f8fafd]">
                        <td className="py-2 px-3 font-semibold text-[#1f1f1f]">{v.sprintName}</td>
                        <td className="py-2 px-3 text-[#747775]">
                          {sprint ? `${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-[#747775]">{v.planned}</td>
                        <td className="py-2 px-3 text-right font-semibold text-[#1f1f1f]">{v.completed}</td>
                        <td className="py-2 px-3 text-right font-bold text-[#1a73e8]">{v.velocity}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            completionPct >= 80 ? 'bg-emerald-100 text-emerald-800' :
                            completionPct >= 50 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {completionPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
