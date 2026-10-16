import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Compass,
  Layers,
  Link2,
  Unlink,
  PauseCircle,
  Archive,
  ArchiveRestore,
  Pencil,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge, PriorityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { IssueSection, IssueField } from '../../components/issues';
import { InitiativeFormModal } from './InitiativeFormModal';
import { LinkEpicModal } from './LinkEpicModal';
import { issuePath } from '../../utils/issueUrl';
import { formatShortDate, getDueDateClass, getDueDateLabel } from '../../utils/dateUtils';
import { canAssignTasks, canArchiveSprint } from '../../utils/roleUtils';
import { resolveLinkedEpics, unlinkEpicFromInitiative } from '../../utils/initiativeEpics';
import {
  calculateInitiativeProgress,
  isInitiativeOverdue,
} from '../../utils/initiativeProgress';
import {
  INITIATIVE_BOARD_STATUS_LABEL,
  initiativeBoardStatusOf,
  getAllowedInitiativeBoardMoves,
  planInitiativeBoardMove,
  explainInitiativeBoardMove,
} from '../../utils/initiativeWorkflow';
import type { InitiativeBoardStatus } from '../../utils/initiativeWorkflow';
import { matchId } from '../../utils/idUtils';

/**
 * Initiative detail: overview fields, schedule health, documented progress
 * from linked work, and the Linked Epics panel (link / unlink, same project
 * only, duplicate links prevented). Status changes go through the
 * centralised workflow — only currently legal board moves are offered.
 */
export const InitiativeDetailPage: React.FC = () => {
  const { initiativeId } = useParams<{ initiativeId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { tasks, users, projects, updateTask, updateTaskStatus } = useAppStore();

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<boolean>(false);

  const role = currentUser?.role;
  const canEdit = role ? canAssignTasks(role) : false;
  const canArchive = role ? canArchiveSprint(role) : false;
  const actorId = currentUser?.id || 'u-admin-01';

  const initiative = useMemo(
    () =>
      tasks.find(
        (t) => t.type === 'INITIATIVE' && matchId(t.id, initiativeId)
      ),
    [tasks, initiativeId]
  );

  const linkedEpics = useMemo(
    () => (initiative ? resolveLinkedEpics(initiative, tasks) : []),
    [initiative, tasks]
  );

  if (!initiative) {
    return (
      <div className="page-header">
        <div>
          <h1 className="page-title">Initiative not found</h1>
          <p className="page-subtitle">
            This Initiative does not exist, was removed, or the link is invalid.
          </p>
        </div>
        <button onClick={() => navigate('/pm/initiatives')} className="btn-secondary btn-sm">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Initiatives
        </button>
      </div>
    );
  }

  const boardStatus = initiativeBoardStatusOf(initiative.status);
  const owner = users.find((u) => u.id === initiative.assigneeId);
  const project = projects.find((p) => p.id === initiative.projectId);
  const progress = calculateInitiativeProgress(initiative, tasks);
  const isOverdue = isInitiativeOverdue(initiative);
  const allowedMoves = getAllowedInitiativeBoardMoves(
    initiative.status,
    initiative.initiativePreviousStatus
  );

  const handleMove = (to: InitiativeBoardStatus) => {
    const plan = planInitiativeBoardMove(initiative.status, to, initiative.initiativePreviousStatus);
    if (!plan.ok) {
      toast.error(
        plan.reason ||
          explainInitiativeBoardMove(initiative.status, to, initiative.initiativePreviousStatus)
      );
      return;
    }
    for (const step of plan.steps) {
      const res = updateTaskStatus(initiative.id, step, actorId);
      if (!res.ok) {
        toast.error(res.reason || 'That move is not allowed.');
        return;
      }
    }
    toast.success(`Initiative moved to ${INITIATIVE_BOARD_STATUS_LABEL[to]}.`);
  };

  const handleUnlink = (epicId: string) => {
    const res = unlinkEpicFromInitiative(initiative, epicId);
    if (!res.ok) {
      toast.error(res.reason || 'Could not unlink that Epic.');
      return;
    }
    updateTask(initiative.id, { linkedEpicIds: res.linkedEpicIds });
    const epic = tasks.find((t) => t.id === epicId);
    toast.success(`Epic "${epic?.title ?? epicId}" unlinked. The Epic itself is unchanged.`);
  };

  const handleArchiveToggle = () => {
    if (!canArchive) {
      toast.error('You do not have permission to archive Initiatives.');
      return;
    }
    updateTask(initiative.id, { isArchived: !initiative.isArchived });
    toast.success(
      initiative.isArchived
        ? `Initiative "${initiative.title}" restored.`
        : `Initiative "${initiative.title}" archived.`
    );
    setArchiveTarget(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate('/pm/initiatives')}
            className="p-2 rounded-lg hover:bg-[#f1f3f4] text-[#5e6470] transition-colors mt-0.5"
            aria-label="Back to Initiatives"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {initiative.issueKey && (
                <span className="text-xs font-bold text-[#0052cc]">{initiative.issueKey}</span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                  boardStatus === 'COMPLETED'
                    ? 'badge-green'
                    : boardStatus === 'ON_HOLD'
                      ? 'badge-amber'
                      : boardStatus === 'IN_PROGRESS'
                        ? 'badge-teal'
                        : boardStatus === 'PLANNED'
                          ? 'badge-indigo'
                          : 'badge-gray'
                }`}
              >
                {boardStatus === 'ON_HOLD' && <PauseCircle className="w-2.5 h-2.5" />}
                {INITIATIVE_BOARD_STATUS_LABEL[boardStatus]}
              </span>
              {initiative.isArchived && (
                <span className="badge badge-gray text-[9px]">ARCHIVED</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-[#1a1d23] mt-1 flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#b45309] flex-shrink-0" />
              <span className="min-w-0 truncate">{initiative.title}</span>
            </h1>
            {project && (
              <p className="text-xs text-[#9ca3af] mt-0.5">{project.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status transition control — only legal moves are offered */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleMove(e.target.value as InitiativeBoardStatus);
            }}
            className="select text-xs py-1.5 w-40"
            aria-label="Move Initiative to stage"
            disabled={allowedMoves.length === 0}
          >
            <option value="">
              {allowedMoves.length === 0
                ? boardStatus === 'COMPLETED'
                  ? 'Completed (final)'
                  : 'No moves available'
                : `Move from ${INITIATIVE_BOARD_STATUS_LABEL[boardStatus]}...`}
            </option>
            {allowedMoves.map((m) => (
              <option key={m.to} value={m.to}>
                {INITIATIVE_BOARD_STATUS_LABEL[m.to]}
              </option>
            ))}
          </select>
          {canEdit && (
            <button onClick={() => setEditOpen(true)} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => setArchiveTarget(true)}
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            >
              {initiative.isArchived ? (
                <>
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  Restore
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Main column */}
        <div className="space-y-3.5 min-w-0">
          <IssueSection title="Overview">
            <div className="text-xs text-[#444746] leading-relaxed whitespace-pre-wrap">
              {initiative.description?.trim() ||
                'No description yet — use Edit to add one.'}
            </div>
          </IssueSection>

          <IssueSection
            title="Progress"
            meta={
              progress.hasLinkedWork
                ? `${progress.completed}/${progress.total} items`
                : undefined
            }
          >
            {progress.hasLinkedWork && progress.percent !== null ? (
              <div className="space-y-2">
                <ProgressBar value={progress.percent} color="#0d9488" showLabel />
                <p className="text-[11px] text-[#9ca3af]">
                  Calculated from {progress.total} work item{progress.total === 1 ? '' : 's'} under
                  the {linkedEpics.length} linked Epic{linkedEpics.length === 1 ? '' : 's'} (
                  {progress.completed} complete). Items outside the linked Epic subtrees are never
                  counted.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-5 text-center">
                <p className="text-xs font-bold text-[#5e6470]">Progress not tracked yet</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">
                  Link at least one Epic with work items to see progress. No values are estimated
                  in the meantime.
                </p>
              </div>
            )}
          </IssueSection>

          <IssueSection
            title="Linked Epics"
            meta={`${linkedEpics.length} linked`}
            action={
              canEdit ? (
                <button
                  onClick={() => setLinkOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-[#ccfbf1] px-2 py-1 text-[10px] font-bold text-[#0f766e] hover:bg-[#99f6e4] transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  Link Epic
                </button>
              ) : undefined
            }
          >
            {linkedEpics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-5 text-center">
                <Layers className="w-5 h-5 text-[#cbd5e1] mx-auto mb-1.5" />
                <p className="text-xs font-bold text-[#5e6470]">No Epics linked yet</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">
                  {canEdit
                    ? 'Link existing Epics from this project — they keep their ids and relationships.'
                    : 'A PM or lead can link Epics from this project.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedEpics.map((epic) => (
                  <div
                    key={epic.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e5ea] bg-[#f8fafc] px-3 py-2.5"
                  >
                    <button
                      onClick={() => navigate(issuePath(epic))}
                      className="min-w-0 text-left group"
                    >
                      <span className="flex items-center gap-2 flex-wrap">
                        {epic.issueKey && (
                          <span className="text-[10px] font-bold text-[#0052cc]">
                            {epic.issueKey}
                          </span>
                        )}
                        <StatusBadge status={epic.status} />
                        {epic.dueDate && (
                          <span className={`text-[10px] ${getDueDateClass(epic.dueDate)}`}>
                            {getDueDateLabel(epic.dueDate)}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs font-semibold text-[#1a1d23] truncate group-hover:text-[#0d9488] transition-colors mt-0.5">
                        {epic.title}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleUnlink(epic.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#e2e5ea] bg-white px-2 py-1 text-[10px] font-bold text-[#5e6470] hover:border-[#ef4444] hover:text-[#d93025] transition-colors flex-shrink-0"
                        title="Unlink Epic (the Epic itself is kept)"
                      >
                        <Unlink className="w-3 h-3" />
                        Unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </IssueSection>
        </div>

        {/* Sidebar */}
        <div className="space-y-3.5">
          <IssueSection title="Details">
            <div className="space-y-3">
              <IssueField label="Status">
                {INITIATIVE_BOARD_STATUS_LABEL[boardStatus]}
              </IssueField>
              <IssueField label="Priority">
                <PriorityBadge priority={initiative.priority} />
              </IssueField>
              <IssueField label="Owner">
                {owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={owner.name} color={owner.avatarColor} size="xs" />
                    <span className="text-xs font-medium text-[#1a1d23]">{owner.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-[#9ca3af]">Unassigned</span>
                )}
              </IssueField>
              <IssueField label="Start Date">
                {initiative.startDate ? (
                  formatShortDate(initiative.startDate)
                ) : (
                  <span className="text-[#9ca3af]">Not set</span>
                )}
              </IssueField>
              <IssueField label="Target Date">
                <span className={getDueDateClass(initiative.dueDate)}>
                  {initiative.dueDate ? getDueDateLabel(initiative.dueDate) : 'Not set'}
                </span>
                {isOverdue && (
                  <span className="ml-2 text-[10px] font-bold text-[#ef4444]">OVERDUE</span>
                )}
              </IssueField>
            </div>
          </IssueSection>
        </div>
      </div>

      <InitiativeFormModal
        isOpen={editOpen}
        initiative={initiative}
        onClose={() => setEditOpen(false)}
      />
      <LinkEpicModal
        isOpen={linkOpen}
        initiative={initiative}
        onClose={() => setLinkOpen(false)}
      />
      <ConfirmDialog
        isOpen={archiveTarget}
        onClose={() => setArchiveTarget(false)}
        onConfirm={handleArchiveToggle}
        title={initiative.isArchived ? 'Restore Initiative' : 'Archive Initiative'}
        message={
          initiative.isArchived
            ? `Restore "${initiative.title}"? It will reappear in Initiative lists and the board.`
            : `Archive "${initiative.title}"? It will be hidden from lists and the board until restored. Linked Epics are kept.`
        }
        confirmLabel={initiative.isArchived ? 'Restore Initiative' : 'Archive Initiative'}
        danger={!initiative.isArchived}
      />
    </div>
  );
};
