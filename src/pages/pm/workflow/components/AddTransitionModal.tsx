import React, { useState } from 'react';
import { X, ArrowRight, GitPullRequest } from 'lucide-react';
import type { WorkflowStage } from '../../../../types';

interface AddTransitionModalProps {
  isOpen: boolean;
  stages: WorkflowStage[];
  onClose: () => void;
  onAddTransition: (transition: { fromStageId: string; toStageId: string; name: string }) => void;
}

export const AddTransitionModal: React.FC<AddTransitionModalProps> = ({
  isOpen,
  stages,
  onClose,
  onAddTransition,
}) => {
  const [fromStageId, setFromStageId] = useState<string>(stages[0]?.id || 'START');
  const [toStageId, setToStageId] = useState<string>(stages[1]?.id || 'DONE');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStageId || !toStageId || fromStageId === toStageId) return;

    onAddTransition({
      fromStageId,
      toStageId,
      name: '',
    });

    onClose();
  };

  const fromOptions = [
    { id: 'START', label: '▶ START (Initial Entry)' },
    { id: 'ANY', label: '✦ ANY (All Workflow Stages)' },
    ...stages.map((s) => ({ id: s.id, label: s.name })),
  ];

  const toOptions = [
    ...stages.map((s) => ({ id: s.id, label: s.name })),
    { id: 'DONE', label: '✔ DONE (Completed State)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001d35]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1f1f] font-display">Add Workflow Transition</h3>
              <p className="text-xs text-[#747775]">Create an interactive transition path between stages</p>
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
          {/* From Stage */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              From Stage <span className="text-[#d93025]">*</span>
            </label>
            <select
              value={fromStageId}
              onChange={(e) => setFromStageId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
            >
              {fromOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* To Stage */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              To Stage <span className="text-[#d93025]">*</span>
            </label>
            <select
              value={toStageId}
              onChange={(e) => setToStageId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
            >
              {toOptions.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.id === fromStageId}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {fromStageId === toStageId && (
            <div className="p-3 rounded-xl bg-[#fce8e6] text-[#d93025] text-xs">
              Source and Target stage cannot be identical.
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#f1f3f4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e0e2ec] hover:bg-[#f0f4f9] text-xs font-semibold text-[#444746] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fromStageId === toStageId}
              className="px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#0b57d0] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Create Transition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
