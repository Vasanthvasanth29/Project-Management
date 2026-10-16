import React, { useMemo, useState } from 'react';
import {
  X, Flag, CheckCircle, Clock, AlertTriangle, ArrowRight, BarChart3, Target,
  MessageSquareHeart
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { StatusBadge } from '../../components/common/Badges';
import { ProgressBar } from '../../components/common/ProgressBar';
import type { Sprint, SprintIncompleteTaskAction } from '../../types';
import { toast } from 'sonner';

interface SprintCompletionModalProps {
  sprint: Sprint;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (action: SprintIncompleteTaskAction, startRetro?: boolean) => void;
}

export const SprintCompletionModal: React.FC<SprintCompletionModalProps> = ({
  sprint,
  isOpen,
  onClose,
  onComplete,
}) => {
  const { tasks, users, updateSprintStatus, handleIncompleteTasks, addActivity, addNotification } = useAppStore();
  const [selectedAction, setSelectedAction] = useState<SprintIncompleteTaskAction>('MOVE_TO_NEXT_SPRINT');
  const [confirmed, setConfirmed] = useState(false);

  const sprintTasks = useMemo(() => tasks.filter((t) => t.sprintId === sprint.id), [tasks, sprint.id]);
  const doneTasks = sprintTasks.filter((t) => t.status === 'DONE');
  const inProgressTasks = sprintTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING');
  const remainingTasks = sprintTasks.filter((t) => t.status === 'TODO');
  const blockedTasks = sprintTasks.filter((t) => t.status === 'BLOCKED');
  const incompleteTasks = sprintTasks.filter((t) => t.status !== 'DONE');

  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const completedPoints = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalHours = sprintTasks.reduce((sum, t) => sum + (t.originalEstimate || t.estimatedHours || 0), 0);
  const loggedHours = sprintTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

  const completionPct = sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0;
  const velocity = completedPoints;

  const handleComplete = (startRetro = false) => {
    if (!confirmed) {
      toast.error('Please confirm the iteration completion');
      return;
    }
    handleIncompleteTasks(sprint.id, selectedAction);
    updateSprintStatus(sprint.id, 'COMPLETED');
    addActivity({
      organizationId: 'org-001',
      userId: 'u-pm-01',
      action: 'completed sprint',
      entityType: 'SPRINT',
      entityId: sprint.id,
      entityTitle: sprint.name,
      createdAt: new Date().toISOString(),
    });
    toast.success(`"${sprint.name}" completed!`);
    onComplete(selectedAction, startRetro);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Flag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Complete Iteration: {sprint.name}</h2>
              <p className="text-xs text-slate-500">{sprint.startDate} - {sprint.endDate}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{sprintTasks.length}</div>
              <div className="text-[10px] text-slate-500">Total Tasks</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-700">{doneTasks.length}</div>
              <div className="text-[10px] text-slate-500">Completed</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-blue-700">{inProgressTasks.length}</div>
              <div className="text-[10px] text-slate-500">In Progress</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-red-700">{blockedTasks.length}</div>
              <div className="text-[10px] text-slate-500">Blocked</div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">Completion: {completionPct}%</span>
              <span className="text-xs font-bold text-slate-800">{doneTasks.length}/{sprintTasks.length} tasks</span>
            </div>
            <ProgressBar value={completionPct} height="sm" color="#34a853" />
          </div>

          {/* Story Points & Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-bold text-blue-700 uppercase">Story Points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-900">{completedPoints}/{totalPoints}</span>
                <span className="text-[10px] text-blue-600">Velocity: {velocity}</span>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-[10px] font-bold text-purple-700 uppercase">Hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-purple-900">{loggedHours}h/{totalHours}h</span>
                <span className="text-[10px] text-purple-600">{totalHours > 0 ? Math.round((loggedHours / totalHours) * 100) : 0}% used</span>
              </div>
            </div>
          </div>

          {/* Incomplete Tasks */}
          {incompleteTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Incomplete Tasks ({incompleteTasks.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                {incompleteTasks.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  return (
                    <div key={task.id} className="px-3 py-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">{task.title}</span>
                        <StatusBadge status={task.status} resolution={task.resolution} />
                      </div>
                      <span className="text-slate-500 flex-shrink-0 ml-2">{task.storyPoints || 0} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Selection */}
          {incompleteTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">What to do with incomplete tasks?</h3>
              <div className="space-y-2">
                {[
                  { value: 'MOVE_TO_NEXT_SPRINT', label: 'Move to next iteration', desc: 'Tasks will be automatically assigned to the next planned iteration' },
                  { value: 'MOVE_TO_BACKLOG', label: 'Move to work queue', desc: 'Tasks will be moved to the project work queue' },
                  { value: 'REMAIN_IN_COMPLETED', label: 'Keep in completed iteration', desc: 'Tasks will remain in this iteration for reference' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedAction === opt.value ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="incompleteAction"
                      value={opt.value}
                      checked={selectedAction === opt.value}
                      onChange={(e) => setSelectedAction(e.target.value as SprintIncompleteTaskAction)}
                      className="mt-0.5 w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{opt.label}</div>
                      <div className="text-[10px] text-slate-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 text-amber-600"
              />
              <span className="text-xs font-medium text-amber-800">
                I understand this action will mark the iteration as completed and cannot be undone.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => handleComplete(false)}
            disabled={!confirmed}
            className={`btn-sm text-xs flex items-center gap-1.5 ${confirmed ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <Flag className="w-3.5 h-3.5" />
            Complete Iteration
          </button>
          <button
            onClick={() => handleComplete(true)}
            disabled={!confirmed}
            className={`btn-sm text-xs flex items-center gap-1.5 font-bold shadow-xs ${confirmed ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            Complete & Start Retrospective
          </button>
        </div>
      </div>
    </div>
  );
};
