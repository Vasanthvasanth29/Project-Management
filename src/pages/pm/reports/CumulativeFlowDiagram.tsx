import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAppStore } from '../../../store/appStore';
import { collectSprintWorkItems } from '../../../utils/sprintIssues';
import { isCancelledWorkItem } from '../../../utils/roleUtils';

interface CFDProps {
  projectId: string;
}

export const CumulativeFlowDiagram: React.FC<CFDProps> = ({ projectId }) => {
  const { tasks, sprints } = useAppStore();

  const projectSprints = useMemo(() => {
    return sprints
      .filter((s) => s.projectId === projectId && s.status === 'COMPLETED')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [sprints, projectId]);

  const chartData = useMemo(() => {
    if (projectSprints.length === 0) return [];
    return projectSprints.map((sprint) => {
      const sprintTasks = collectSprintWorkItems({ sprintId: sprint.id, projectId });
      const isCancelled = (t: { status: string; resolution?: string }) =>
        isCancelledWorkItem(t);
      const todo = sprintTasks.filter((t) => t.status === 'TODO').length;
      const inProgress = sprintTasks.filter((t) =>
        t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING' ||
        t.status === 'BUG_FIX' || t.status === 'RETEST'
      ).length;
      const blocked = sprintTasks.filter((t) => t.status === 'BLOCKED').length;
      const done = sprintTasks.filter((t) => t.status === 'DONE' && !isCancelled(t)).length;
      // Cancelled gets its own band: it is a terminal outcome, not Done.
      const cancelled = sprintTasks.filter(isCancelled).length;
      return {
        name: sprint.name,
        'To Do': todo,
        'In Progress': inProgress,
        'Blocked': blocked,
        'Done': done,
        'Cancelled': cancelled,
      };
    });
  }, [projectSprints, tasks, projectId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Cumulative Flow Diagram</h2>
            <p className="text-xs text-slate-500">Work item status distribution over time</p>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <p className="text-xs">No completed iterations to display.</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e2ec" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#747775' }} />
                <YAxis tick={{ fontSize: 10, fill: '#747775' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="To Do" stackId="1" stroke="#747775" fill="#e0e2ec" />
                <Area type="monotone" dataKey="In Progress" stackId="1" stroke="#1a73e8" fill="#d2e3fc" />
                <Area type="monotone" dataKey="Blocked" stackId="1" stroke="#d93025" fill="#f8d7da" />
                <Area type="monotone" dataKey="Done" stackId="1" stroke="#34a853" fill="#ceead6" />
                <Area type="monotone" dataKey="Cancelled" stackId="1" stroke="#9aa0a6" fill="#dadce0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};