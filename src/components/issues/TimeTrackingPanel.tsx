import React, { useState } from 'react';
import type { Task } from '../../types';
import { Timer, Plus, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { IssueSection } from './IssueSection';
import { IssueField } from './IssueField';

interface TimeTrackingPanelProps {
  task: Task;
  defaultOpen?: boolean;
}

const hours = (value?: number) => `${value ?? 0}h`;

/** Estimated / Remaining / Logged time for an issue, with a quick log-work form. */
export const TimeTrackingPanel: React.FC<TimeTrackingPanelProps> = ({ task, defaultOpen = true }) => {
  const { addTimeLog } = useAppStore();
  const { currentUser } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logDesc, setLogDesc] = useState('');

  const estimated = task.originalEstimate ?? task.estimatedHours ?? 0;
  const logged =
    task.loggedHours ?? task.timeLogs?.reduce((sum, log) => sum + log.hours, 0) ?? 0;
  const remaining = task.remainingEstimate ?? Math.max(0, estimated - logged);
  const pct = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(logHours);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Please enter valid hours');
      return;
    }
    addTimeLog(task.id, currentUser?.id || task.createdById, parsed, logDesc);
    setShowForm(false);
    setLogHours('');
    setLogDesc('');
    toast.success(`Logged ${parsed} hours`);
  };

  return (
    <IssueSection
      title="Time Tracking"
      icon={<Timer className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      action={
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-secondary btn-xs flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Log work
        </button>
      }
      bodyClassName="space-y-3"
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-3.5 border border-slate-200 bg-slate-50 space-y-2.5 animate-slide-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={logHours}
              onChange={(e) => setLogHours(e.target.value)}
              placeholder="Hours"
              className="input bg-white text-xs py-2"
              required
            />
            <input
              type="text"
              value={logDesc}
              onChange={(e) => setLogDesc(e.target.value)}
              placeholder="Work description"
              className="input bg-white text-xs py-2 sm:col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-xs" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-xs" disabled={!logHours}>
              <PlayCircle className="w-3.5 h-3.5" /> Log time
            </button>
          </div>
        </form>
      )}

      <IssueField label="Estimated">{hours(estimated)}</IssueField>
      <IssueField label="Remaining">
        <span className="text-slate-800">{hours(remaining)}</span>
      </IssueField>
      <IssueField label="Logged">
        <span className="text-slate-800">{hours(logged)}</span>
      </IssueField>

      <div className="pt-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Progress</span>
          <span>{pct}% of estimate</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-amber-500' : 'bg-[#0d9488]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </IssueSection>
  );
};
