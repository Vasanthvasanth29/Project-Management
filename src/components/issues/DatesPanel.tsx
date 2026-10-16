import React from 'react';
import type { Task } from '../../types';
import { CalendarDays } from 'lucide-react';
import { IssueSection } from './IssueSection';
import { IssueField } from './IssueField';
import { formatDate, formatFullDateTime, formatDueDate } from '../../utils/dateUtils';

interface DatesPanelProps {
  task: Task;
  defaultOpen?: boolean;
}

/** Created / Updated / Resolved / Due date for an issue. */
export const DatesPanel: React.FC<DatesPanelProps> = ({ task, defaultOpen = true }) => {
  const resolvedAt = task.resolvedAt || (task.status === 'DONE' ? task.completedAt : undefined);

  return (
    <IssueSection
      title="Dates"
      icon={<CalendarDays className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      bodyClassName="space-y-3"
    >
      <IssueField label="Created">{formatFullDateTime(task.createdAt)}</IssueField>
      <IssueField label="Updated">{formatFullDateTime(task.updatedAt || task.createdAt)}</IssueField>
      <IssueField label="Resolved">
        {resolvedAt ? (
          <span className="text-slate-800 font-bold">{formatDate(resolvedAt)}</span>
        ) : (
          'Not resolved'
        )}
      </IssueField>
      <IssueField label="Due Date">
        <span className="text-slate-800 2xl:whitespace-nowrap">{formatDueDate(task.dueDate)}</span>
      </IssueField>
    </IssueSection>
  );
};
