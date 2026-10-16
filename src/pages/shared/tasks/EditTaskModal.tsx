import React, { useState, useEffect } from 'react';
import { X, Save, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { TaskTypeBadge } from './TaskTypeBadge';
import { getStatusLabel, isCancelledWorkItem } from '../../../utils/roleUtils';
import { getAllowedInitiativeTransitions } from '../../../utils/initiativeWorkflow';
import type { Task, TaskStatus, Priority } from '../../../types';

interface EditTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ isOpen, task, onClose }) => {
  const { users, teams, updateTask } = useAppStore();
  const { currentUser } = useAuthStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setTeamId(task.teamId || '');
      setAssigneeId(task.assigneeId || '');
      setPriority(task.priority || 'MEDIUM');
      setStatus(task.status || 'TODO');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const taskCancelled = isCancelledWorkItem(task);
  // Initiatives offer only the transitions the centralised workflow allows —
  // never a raw status picker, and never an illegal move (the store re-checks).
  const isInitiative = task.type === 'INITIATIVE';
  const initiativeTransitions = isInitiative
    ? getAllowedInitiativeTransitions(task.status, task.initiativePreviousStatus)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const res = updateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      teamId: teamId || undefined,
      assigneeId: assigneeId || undefined,
      priority,
      status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    }, currentUser?.id || '');

    if (!res.ok) {
      toast.error(res.reason || 'That status change is not allowed.');
      return;
    }

    toast.success(`${task.type} "${title.trim()}" updated successfully!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#1f1f1f] font-display">Edit Work Item</h3>
                <TaskTypeBadge type={task.type} />
              </div>
              <p className="text-xs text-[#747775]">Update item details and assignment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e0e2ec] text-[#747775] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Title <span className="text-[#d93025]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-sm font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] resize-none"
            />
          </div>

          {/* Team (if applicable) */}
          {task.type !== 'EPIC' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="">No team assigned</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Due Date & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          {/* Assignee & Status Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  disabled={taskCancelled}
                  aria-label="Status"
                  className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isInitiative ? (
                    /* Only the current stage plus the workflow's valid transitions. */
                    <>
                      <option value={task.status}>
                        {task.status === 'ON_HOLD' ? 'On Hold' : getStatusLabel(task.status)}
                      </option>
                      {initiativeTransitions.map((to) => (
                        <option key={to} value={to}>
                          {task.status === 'ON_HOLD' ? `Resume to ${getStatusLabel(to)}` : getStatusLabel(to)}
                        </option>
                      ))}
                    </>
                  ) : taskCancelled ? (
                    /* Cancelled (real status or legacy DONE + resolution): the edit dialog
                       never shows it as Done; status changes go through the transition UI. */
                    <option value={task.status}>Cancelled</option>
                  ) : (
                    <>
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="TESTING">Testing</option>
                      <option value="DONE">Done</option>
                      <option value="CANCELLED">Cancelled</option>
                    </>
                  )}
                </select>
              </div>
              {isInitiative && (
                <p className="text-[10px] text-[#9aa0a6]">
                  Only valid Initiative workflow moves are listed.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#f1f3f4] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e0e2ec] hover:bg-[#f0f4f9] text-xs font-semibold text-[#444746] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#0b57d0] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
