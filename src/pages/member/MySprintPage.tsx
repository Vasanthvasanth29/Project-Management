import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { ProgressBar } from '../../components/common/ProgressBar';
import { KanbanBoard } from '../shared/KanbanBoard';
import { EmptyState } from '../../components/common/EmptyState';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import { CalendarRange } from 'lucide-react';

export const MySprintPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { sprints, tasks, projects } = useAppStore();

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE');
  // ADMIN bypasses assignee scoping: the board shows every work item in the iteration.
  const sprintTasks = activeSprint
    ? tasks.filter(
        (t) => t.sprintId === activeSprint.id && (currentUser?.role === 'ADMIN' || t.assigneeId === currentUser?.id)
      )
    : [];
  // Cancelled work leaves the completion ratio: never done, never in scope.
  const scopeTasks = sprintTasks.filter((t) => !isCancelledWorkItem(t));
  const doneCount = scopeTasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Current Iteration</h1>
        <p className="page-subtitle">Iteration tasks and current board state</p>
      </div>

      {!activeSprint ? (
        <div className="card p-8">
          <EmptyState icon={CalendarRange} title="No live iteration" description="There is currently no live iteration running." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900">{activeSprint.name}</h2>
            <p className="text-xs text-slate-500 mb-3">{activeSprint.goal}</p>
            <ProgressBar
              value={scopeTasks.length > 0 ? Math.round((doneCount / scopeTasks.length) * 100) : 0}
              showLabel
            />
          </div>

          <KanbanBoard taskIds={sprintTasks.map((t) => t.id)} />
        </div>
      )}
    </div>
  );
};
