import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAppStore } from '../../../store/appStore';

interface WorkloadProps {
  projectId: string;
}

export const WorkloadReport: React.FC<WorkloadProps> = ({ projectId }) => {
  const { tasks, users, teams } = useAppStore();

  const workloadData = useMemo(() => {
    const activeTasks = tasks.filter(
      (t) => t.projectId === projectId && t.status !== 'DONE' && t.assigneeId
    );

    const userWorkload = new Map<string, { name: string; tasks: number; storyPoints: number; hours: number }>();

    activeTasks.forEach((t) => {
      if (!t.assigneeId) return;
      const user = users.find((u) => u.id === t.assigneeId);
      if (!user) return;
      const existing = userWorkload.get(t.assigneeId) || { name: user.name, tasks: 0, storyPoints: 0, hours: 0 };
      existing.tasks += 1;
      existing.storyPoints += t.storyPoints || 0;
      existing.hours += t.remainingEstimate || t.estimatedHours || 0;
      userWorkload.set(t.assigneeId, existing);
    });

    return Array.from(userWorkload.values())
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 10);
  }, [tasks, users, projectId]);

  const totalPoints = useMemo(() => workloadData.reduce((sum, w) => sum + w.storyPoints, 0), [workloadData]);
  const totalHours = useMemo(() => workloadData.reduce((sum, w) => sum + w.hours, 0), [workloadData]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Team Workload</h2>
              <p className="text-xs text-slate-500">Active work distribution by assignee</p>
            </div>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-lg font-bold text-slate-800">{totalPoints}</div>
              <div className="text-[10px] text-slate-500">Total Points</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{totalHours}h</div>
              <div className="text-[10px] text-slate-500">Total Hours</div>
            </div>
          </div>
        </div>
        {workloadData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <p className="text-xs">No active tasks with assignees.</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e2ec" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#747775' }} />
                <YAxis tick={{ fontSize: 10, fill: '#747775' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tasks" fill="#1a73e8" name="Tasks" radius={[4, 4, 0, 0]} />
                <Bar dataKey="storyPoints" fill="#34a853" name="Story Points" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};