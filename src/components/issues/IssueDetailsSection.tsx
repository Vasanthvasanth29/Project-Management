import React from 'react';
import type { Task, WorkItemType, IssueResolution, EpicWorkflowStatus, ProductRisk } from '../../types';
import { useAppStore } from '../../store/appStore';
import { StatusBadge, PriorityBadge } from '../common/Badges';
import { TaskTypeBadge } from '../../pages/shared/tasks/TaskTypeBadge';
import { IssueSection } from './IssueSection';
import { IssueField, IssueChips } from './IssueField';
import { CustomFieldHeaderAction, useCustomFieldRows } from './IssueCustomFields';
import { ParentLink } from './ParentLink';
import { resolveParentLink, getParentFieldLabel } from '../../utils/workItemHierarchy';
import { formatDueDate } from '../../utils/dateUtils';
import { AlertTriangle, Compass, Layers } from 'lucide-react';

const RESOLUTION_LABEL: Record<IssueResolution, string> = {
  FIXED: 'Fixed',
  DONE: 'Done',
  WONT_DO: "Won't Do",
  DUPLICATE: 'Duplicate',
  CANNOT_REPRODUCE: 'Cannot Reproduce',
  CANCELLED: 'Cancelled',
};

const EPIC_STATUS_LABEL: Record<EpicWorkflowStatus, string> = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
};

const RISK_CLASS: Record<ProductRisk, string> = {
  LOW: 'font-semibold text-slate-800',
  MEDIUM: 'font-semibold text-slate-800',
  HIGH: 'font-semibold text-slate-800',
  CRITICAL: 'font-semibold text-slate-800',
};

const PLANNING_TYPES: WorkItemType[] = ['INITIATIVE', 'FEATURE', 'EPIC'];

interface IssueDetailsSectionProps {
  task: Task;
  onOpenIssue?: (taskId: string) => void;
  defaultOpen?: boolean;
}

/**
 * Details grid. Fields are rendered per issue type:
 *   Initiative -> planning level fields (incl. multiple Application CIs)
 *   Feature    -> parent initiative, team, DoR, product risk
 *   Epic       -> epic name, epic status, parent feature
 *   others     -> delivery fields (type, status, due date, ...)
 */
export const IssueDetailsSection: React.FC<IssueDetailsSectionProps> = ({
  task,
  onOpenIssue,
  defaultOpen = true,
}) => {
  const { tasks, teams } = useAppStore();
  const { rows: customFieldRows, modals: customFieldModals } = useCustomFieldRows(task);

  // Type-aware parent for "Parent Link": Task -> Story, Story -> Epic,
  // Epic -> Feature (see resolveParentLink). Undefined renders as "—"; a
  // parent of the wrong type is never substituted.
  const typeParent = resolveParentLink(tasks, task);
  const team = teams.find((t) => t.id === task.teamId);

  const isPlanningItem = PLANNING_TYPES.includes(task.type);
  const fields: React.ReactNode[] = [];
  const leftFields: React.ReactNode[] = [];
  const rightFields: React.ReactNode[] = [];

  const resolutionNode = task.resolution ? (
    <span className="font-semibold text-slate-800">{RESOLUTION_LABEL[task.resolution]}</span>
  ) : (
    <span className="font-semibold text-slate-800">Unresolved</span>
  );

  const typeField = (
    <IssueField key="type" label="Type">
      <span className="inline-flex items-center gap-2">
        <TaskTypeBadge type={task.type} plain />
      </span>
    </IssueField>
  );
  const statusField = (
    <IssueField key="status" label="Status">
      <StatusBadge status={task.status} resolution={task.resolution} plain />
    </IssueField>
  );
  const priorityField = (
    <IssueField key="priority" label="Priority">
      <PriorityBadge priority={task.priority} plain />
    </IssueField>
  );

  fields.push(typeField, statusField, priorityField);

  if (isPlanningItem) {
    if (task.type !== 'INITIATIVE') {
      const isEpic = task.type === 'EPIC';
      fields.push(
        <IssueField key="parent" label={isEpic ? 'Parent Link' : getParentFieldLabel(task.type)}>
          {typeParent ? <ParentLink parent={typeParent} onOpen={onOpenIssue} /> : undefined}
        </IssueField>
      );
    }

    if (task.type === 'EPIC') {
      fields.push(
        <IssueField key="epicName" label="Epic Name">
          {task.epicName ? (
            <span className="text-slate-800 font-bold">{task.epicName}</span>
          ) : undefined}
        </IssueField>
      );
    }

    if (task.type === 'EPIC') {
      fields.push(
        <IssueField key="epicStatus" label="Epic Status">
          <span className="font-semibold text-slate-800">
            {EPIC_STATUS_LABEL[task.epicStatus || 'TO_DO']}
          </span>
        </IssueField>
      );
    }

    if (task.type === 'FEATURE') {
      fields.push(
        <IssueField key="teamName" label="Team Name">
          {task.teamName || team?.name || undefined}
        </IssueField>
      );
      fields.push(
        <IssueField key="risk" label="Product Risk">
          {task.productRisk ? (
            <span className={RISK_CLASS[task.productRisk]}>{task.productRisk}</span>
          ) : undefined}
        </IssueField>
      );
    }
  }
  // Non-planning issues (Story/Task/Bug/Sub-task) build their own left/right
  // field lists further below instead of this shared `fields` array.

  const affectsField = (
    <IssueField key="affects" label="Affected Releases">
      <IssueChips values={task.affectsVersions} />
    </IssueField>
  );
  const componentsField = (
    <IssueField key="components" label="Modules">
      <IssueChips values={task.components} />
    </IssueField>
  );
  const labelsField = (
    <IssueField key="labels" label="Tags">
      <IssueChips values={task.tags} />
    </IssueField>
  );
  const fixVersionsField = (
    <IssueField key="fixVersions" label="Target Release">
      <IssueChips values={task.fixVersions} />
    </IssueField>
  );
  const resolutionField = (
    <IssueField key="resolution" label="Resolution">
      {resolutionNode}
    </IssueField>
  );

  fields.push(affectsField, componentsField, labelsField);

  if (isPlanningItem) {
    fields.push(
      <IssueField
        key="ci"
        label={task.type === 'INITIATIVE' ? 'Multiple Application CI (as per CMDB)' : 'Application CI (as per CMDB)'}
      >
        <IssueChips values={task.applicationCis} mono />
      </IssueField>
    );
  }

  fields.push(resolutionField, fixVersionsField);

  // Standard issues (Story / Task / Bug / Sub-task) render into two explicit
  // columns matching the Jira reference grouping; Initiative/Feature/Epic
  // detail layouts are left untouched (single auto-flowing grid above).
  if (!isPlanningItem) {
    const applicationCiField = (
      <IssueField key="ci-l" label="Application CI (as per CMDB)">
        <IssueChips values={task.applicationCis} mono />
      </IssueField>
    );
    const parentField = (
      <IssueField key="parent-r" label="Parent Link">
        {typeParent ? <ParentLink parent={typeParent} onOpen={onOpenIssue} /> : undefined}
      </IssueField>
    );
    const dueField = (
      <IssueField key="due-r" label="Due Date">
        {task.dueDate ? (
          <span className="2xl:whitespace-nowrap">{formatDueDate(task.dueDate)}</span>
        ) : undefined}
      </IssueField>
    );

    leftFields.push(
      typeField,
      priorityField,
      affectsField,
      componentsField,
      labelsField,
      applicationCiField
    );
    rightFields.push(
      statusField,
      parentField,
      fixVersionsField,
      dueField,
      resolutionField
    );
  }

  // Custom fields join the native grid as regular IssueField rows (alternating
  // across the two columns), so they read as part of the same Details list.
  const customFieldLeft: React.ReactNode[] = [];
  const customFieldRight: React.ReactNode[] = [];
  customFieldRows.forEach((row, index) => {
    (index % 2 === 0 ? customFieldLeft : customFieldRight).push(row);
  });

  return (
    <IssueSection
      title="Information"
      icon={<Layers className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      bodyClassName="space-y-3"
      action={<CustomFieldHeaderAction task={task} />}
    >
      {task.type === 'INITIATIVE' && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gradient-to-r from-[#f0fdfa] to-[#fffbeb] border border-[#99f6e4]">
          <div className="w-6 h-6 rounded-lg bg-[#0d9488] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0f766e]">
              Top-level planning item
            </p>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
              Initiatives sit above Features and Epics. Use this page to track portfolio scope,
              affected applications and the delivery progress of everything beneath it.
            </p>
          </div>
          <AlertTriangle className="w-4 h-4 text-[#d97706] flex-shrink-0 mt-1 hidden sm:block" />
        </div>
      )}

      {isPlanningItem ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
          {[...fields, ...customFieldRows]}
        </div>
      ) : (
        // Row-paired single grid: every left field shares a grid row with its
        // right counterpart, so both columns stay aligned regardless of row
        // height (wrapping chips, badges). Height comes purely from content —
        // trailing right-side cells are padded with hidden placeholders on
        // desktop so extra left fields keep falling into the left column.
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
          {(() => {
            const leftAll = [...leftFields, ...customFieldLeft];
            const rightAll = [...rightFields, ...customFieldRight];
            const paired: React.ReactNode[] = [];
            for (let i = 0; i < Math.max(leftAll.length, rightAll.length); i++) {
              if (leftAll[i]) paired.push(leftAll[i]);
              if (rightAll[i]) {
                paired.push(rightAll[i]);
              } else {
                paired.push(<span key={`pad-${i}`} className="hidden md:block" />);
              }
            }
            return paired;
          })()}
        </div>
      )}

      {/* Custom-field Edit/Delete overlays: display:contents so they never
          affect the grid above (the fields themselves live inside it). */}
      {customFieldModals}
    </IssueSection>
  );
};
