import React, { useState } from 'react';
import type { Task } from '../../types';
import { Zap, ExternalLink, CheckCircle2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { IssueSection } from './IssueSection';
import { IssueField } from './IssueField';
import { canHaveChildren, getWorkItemLabel } from '../../utils/workItemHierarchy';
import { getProjectUrl } from '../../utils/idUtils';

interface AgilePanelProps {
  task: Task;
  defaultOpen?: boolean;
}

/** Iteration, story points and delivery rollup for a work item. */
export const AgilePanel: React.FC<AgilePanelProps> = ({ task, defaultOpen = true }) => {
  const { sprints, releases, setTaskStoryPoints, getEpicRollup, projects } = useAppStore();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(task.storyPoints ? String(task.storyPoints) : '');

  const sprint = sprints.find((s) => s.id === task.sprintId);
  const release = releases.find((r) => r.id === task.releaseId);
  const project = projects.find((p) => p.id === task.projectId);
  const showRollup = canHaveChildren(task.type);
  const rollup = showRollup ? getEpicRollup(task.id) : null;

  const savePoints = () => {
    const value = points.trim() ? parseInt(points, 10) : undefined;
    if (points.trim() && (isNaN(value as number) || (value as number) < 0)) {
      toast.error('Enter a valid number of story points');
      return;
    }
    setTaskStoryPoints(task.id, value);
    setEditing(false);
    toast.success(value ? `Story points set to ${value}` : 'Story points cleared');
  };

  return (
    <IssueSection
      title="Agile"
      icon={<Zap className="w-3.5 h-3.5 text-[#d97706]" />}
      accent="accent"
      defaultOpen={defaultOpen}
      bodyClassName="space-y-3"
    >
      <IssueField label="Iteration">
        {sprint ? (
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{sprint.name}</span>
            <span className="font-semibold text-slate-800">
              {sprint.status === 'ACTIVE' ? 'Active' : sprint.status === 'COMPLETED' ? 'Done' : 'Planned'}
            </span>
          </span>
        ) : (
          <span className="text-slate-400 font-normal italic">Work Queue</span>
        )}
      </IssueField>

      {sprint && (
        <IssueField label="Iteration Dates">
          <span className="font-normal text-slate-600">
            {new Date(sprint.startDate).toLocaleDateString()} &#8594; {new Date(sprint.endDate).toLocaleDateString()}
          </span>
        </IssueField>
      )}

      <IssueField label="Release">
        {release ? `${release.name}${release.version ? ` (${release.version})` : ''}` : undefined}
      </IssueField>

      <div className="flex items-center justify-between gap-2">
        <span className="w-36 sm:w-40 flex-shrink-0 text-[11px] text-slate-500 font-medium">Story Points</span>
        {editing ? (
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              type="number"
              min="0"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="input text-xs py-1 px-2 w-20"
              autoFocus
            />
            <button
              type="button"
              onClick={savePoints}
              className="p-1.5 rounded-md bg-[#0d9488] text-white hover:bg-[#0f766e] transition-colors"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPoints(task.storyPoints ? String(task.storyPoints) : '');
              setEditing(true);
            }}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-[#0f766e] transition-colors group min-w-0"
          >
            {task.storyPoints ? <span>{task.storyPoints} pts</span> : <span className="text-slate-400 font-normal italic">Not estimated</span>}
            <Pencil className="w-3 h-3 text-slate-300 group-hover:text-[#0d9488]" />
          </button>
        )}
      </div>

      {rollup && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {getWorkItemLabel(task.type)} progress
            </span>
            <span className="text-[11px] font-bold text-slate-800">{rollup.completionPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0d9488] to-[#10b981] transition-all"
              style={{ width: `${rollup.completionPct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#10b981]" /> {rollup.completed}/{rollup.totalTasks} done
            </span>
            <span>{rollup.totalPoints} pts total</span>
            {rollup.blocked > 0 && <span className="text-slate-700 font-bold">{rollup.blocked} blocked</span>}
          </div>
        </div>
      )}

      {project && currentUser && (
        <button
          type="button"
          onClick={() => navigate(getProjectUrl(project, currentUser.role))}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] hover:bg-[#ccfbf1] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open {project.name} board
        </button>
      )}
    </IssueSection>
  );
};
