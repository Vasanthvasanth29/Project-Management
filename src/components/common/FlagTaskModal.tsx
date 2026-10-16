import React, { useState, useEffect } from 'react';
import { Flag, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Task } from '../../types';

interface FlagTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (reason: string) => void;
  onRemoveFlag?: () => void;
}

const COMMON_IMPEDIMENT_REASONS = [
  'Waiting on external dependency / 3rd-party API',
  'Requirements / UX design clarification needed',
  'Blocked by infrastructure / CI/CD environment',
  'Pending security or compliance sign-off',
  'Resource availability / subject matter expert needed',
];

export const FlagTaskModal: React.FC<FlagTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onRemoveFlag,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(task.flaggedReason || '');
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSave(reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-modal border border-slate-200 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200">
              <Flag className="w-4 h-4 fill-amber-500 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                {task.isFlagged ? 'Edit Impediment Flag' : 'Flag as Impeded'}
              </h3>
              <p className="text-xs text-slate-500">
                Highlights the item and alerts the team that progress is blocked or impeded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Impediment Reason / Comment <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe what is impeding this task and what assistance or resolution is needed..."
              rows={3}
              className="input resize-none"
              required
              autoFocus
            />
          </div>

          {/* Quick Reason Suggestions */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Common Impediment Reasons:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_IMPEDIMENT_REASONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setReason(suggestion)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                    reason === suggestion
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200'
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Notice Box */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              Unlike changing the task status to <strong>BLOCKED</strong>, flagging keeps the work in its current stage while drawing immediate visibility on iteration boards and dashboards.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              {task.isFlagged && onRemoveFlag && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveFlag();
                    onClose();
                  }}
                  className="btn-ghost text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 py-1.5 px-3"
                >
                  Remove Flag
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700"
              >
                <Flag className="w-3.5 h-3.5 fill-white" />
                {task.isFlagged ? 'Update Flag' : 'Add Flag'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
