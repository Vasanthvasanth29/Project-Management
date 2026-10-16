import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAppStore } from '../../../store/appStore';
import { isCancelledWorkItem } from '../../../utils/roleUtils';

interface LeadTimeProps {
  projectId: string;
}

export const LeadTimeReport: React.FC<LeadTimeProps> = ({ projectId }) => {
  const { tasks } = useAppStore();

  const leadTimeData = useMemo(() => {
    // Cancelled work is dropped: it never completed, so it is not a lead-time sample.
    const doneTasks = tasks.filter(
      (t) => t.projectId === projectId && t.status === 'DONE' && !isCancelledWorkItem(t) && t.createdAt && t.completedAt
    );
    return doneTasks.map((t) => {
      const created = new Date(t.createdAt);
      const completed = new Date(t.completedAt!);
      const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return { name: t.title.slice(0, 20), days, id: t.id };
    }).slice(0, 15);
  }, [tasks, projectId]);

  const averageLeadTime = useMemo(() => {
    if (leadTimeData.length === 0) return 0;
    const total = leadTimeData.reduce((sum, d) => sum + d.days, 0);
    return Math.round((total / leadTimeData.length) * 10) / 10;
  }, [leadTimeData]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Lead Time</h2>
              <p className="text-xs text-slate-500">Time from creation to completion per task</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-800">{averageLeadTime}d</div>
            <div className="text-[10px] text-slate-500">Avg Lead Time</div>
          </div>
        </div>
        {leadTimeData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <p className="text-xs">No completed tasks to analyze.</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadTimeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e2ec" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#747775' }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#747775' }} label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#747775' } }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                <ReferenceLine y={averageLeadTime} stroke="#ea4335" strokeDasharray="5 5" label={{ value: `Avg: ${averageLeadTime}d`, position: 'right', style: { fontSize: 10, fill: '#ea4335' } }} />
                <Bar dataKey="days" fill="#fbbc04" radius={[4, 4, 0, 0]} name="Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};