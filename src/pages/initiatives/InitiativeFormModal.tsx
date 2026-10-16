import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X, Lock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import {
  INITIATIVE_BOARD_STATUS_LABEL,
  getAllowedInitiativeBoardMoves,
  initiativeBoardStatusOf,
} from '../../utils/initiativeWorkflow';
import type { InitiativeBoardStatus } from '../../utils/initiativeWorkflow';
import type { Priority, Task } from '../../types';

interface InitiativeFormModalProps {
  isOpen: boolean;
  /** Present for edit mode; undefined creates a new Initiative. */
  initiative?: Task;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const toInputDate = (iso: string | undefined): string => {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

/**
 * Create / edit modal for Initiatives (frontend-only, store-backed).
 * Required: name. Validates the start/target date range. On edit, the status
 * field offers only the board stages the centralised workflow currently
 * allows — illegal transitions are never presented as options.
 */
export const InitiativeFormModal: React.FC<InitiativeFormModalProps> = ({
  isOpen,
  initiative,
  onClose,
}) => {
  const { currentUser } = useAuthStore();
  const { users, projects, createTask, updateTask, updateTaskStatus } = useAppStore();

  const isEdit = Boolean(initiative);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [targetBoardStatus, setTargetBoardStatus] = useState<InitiativeBoardStatus | ''>('');

  useEffect(() => {
    if (!isOpen) return;
    if (initiative) {
      setTitle(initiative.title);
      setDescription(initiative.description ?? '');
      setProjectId(initiative.projectId);
      setAssigneeId(initiative.assigneeId ?? '');
      setPriority(initiative.priority);
      setStartDate(toInputDate(initiative.startDate));
      setDueDate(toInputDate(initiative.dueDate));
      setTargetBoardStatus('');
    } else {
      setTitle('');
      setDescription('');
      setProjectId(projects[0]?.id ?? '');
      setAssigneeId('');
      setPriority('MEDIUM');
      setStartDate('');
      setDueDate('');
      setTargetBoardStatus('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initiative?.id]);

  const allowedBoardMoves = useMemo(() => {
    if (!initiative) return [];
    return getAllowedInitiativeBoardMoves(initiative.status, initiative.initiativePreviousStatus);
  }, [initiative]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    if (!title.trim()) {
      toast.error('Please enter a name for the Initiative.');
      return false;
    }
    if (!isEdit && !projectId) {
      toast.error('Please select a project for the Initiative.');
      return false;
    }
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      toast.error('Target date must be on or after the start date.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!initiative) {
      createTask({
        projectId,
        title: title.trim(),
        description: description.trim(),
        type: 'INITIATIVE',
        // Initiatives always enter the workflow at Backlog.
        status: 'BACKLOG',
        priority,
        assigneeId: assigneeId || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        createdById: currentUser?.id || 'u-admin-01',
      });
      toast.success(`Initiative "${title.trim()}" created in Backlog.`);
      onClose();
      return;
    }

    updateTask(initiative.id, {
      title: title.trim(),
      description: description.trim(),
      assigneeId: assigneeId || undefined,
      priority,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });

    if (targetBoardStatus) {
      const move = allowedBoardMoves.find((m) => m.to === targetBoardStatus);
      if (move) {
        for (const step of move.steps) {
          const res = updateTaskStatus(initiative.id, step, currentUser?.id || 'u-admin-01');
          if (!res.ok) {
            toast.error(res.reason || 'That status change is not allowed.');
            break;
          }
        }
        toast.success(`Initiative moved to ${INITIATIVE_BOARD_STATUS_LABEL[move.to]}.`);
      }
    }

    toast.success(`Initiative "${title.trim()}" updated.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e2ec]">
          <h2 className="text-base font-bold text-[#1a1d23]">
            {isEdit ? 'Edit Initiative' : 'Create Initiative'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f1f3f4] text-[#5e6470] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Project <span className="text-[#d93025]">*</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Name <span className="text-[#d93025]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Support Services Portfolio"
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What does this Initiative deliver, and for whom?"
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488] resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Owner
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
                Target Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>
          {startDate && dueDate && new Date(startDate) > new Date(dueDate) && (
            <p className="text-[11px] text-[#d93025] font-medium">
              Target date must be on or after the start date.
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Status
            </label>
            {!isEdit ? (
              <div className="relative">
                <select
                  value="BACKLOG"
                  disabled
                  aria-label="Status"
                  className="w-full px-3 py-2 pr-8 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] opacity-60 cursor-not-allowed appearance-none"
                >
                  <option value="BACKLOG">Backlog</option>
                </select>
                <Lock className="w-3.5 h-3.5 text-[#9aa0a6] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <select
                value={targetBoardStatus}
                onChange={(e) => setTargetBoardStatus(e.target.value as InitiativeBoardStatus)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
              >
                <option value="">
                  {initiativeBoardStatusOf(initiative!.status)} (current)
                </option>
                {allowedBoardMoves.map((m) => (
                  <option key={m.to} value={m.to}>
                    {INITIATIVE_BOARD_STATUS_LABEL[m.to]}
                  </option>
                ))}
                {allowedBoardMoves.length === 0 && (
                  <option value="" disabled>
                    No transitions available
                  </option>
                )}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-sm">
              {isEdit ? 'Save Changes' : 'Create Initiative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
