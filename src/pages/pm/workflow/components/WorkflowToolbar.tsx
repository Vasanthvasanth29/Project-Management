import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowRight, Save, RotateCcw, ChevronDown, Check, GitBranch, Sparkles } from 'lucide-react';

interface WorkflowToolbarProps {
  workflowName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  hasUnsavedChanges: boolean;
  onAddStage: () => void;
  onAddTransition: () => void;
  onUpdateWorkflow: (status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT') => void;
  onDiscardChanges: () => void;
}

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  workflowName,
  status,
  hasUnsavedChanges,
  onAddStage,
  onAddTransition,
  onUpdateWorkflow,
  onDiscardChanges,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getStatusBadge = () => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
            Active workflow
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#747775]" />
            Inactive workflow
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef7e0] text-[#b06000] border border-[#fce8b2]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbbc04]" />
            Draft workflow
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e0e2ec] bg-transparent">
      {/* Title & Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1f1f1f] leading-tight font-display">Workflow</h2>
            <p className="text-xs text-[#747775]">{workflowName || 'Project Workflow Designer'}</p>
          </div>
        </div>

        <div>{getStatusBadge()}</div>

        {hasUnsavedChanges && (
          <span className="text-[11px] font-semibold text-[#b06000] bg-[#fef7e0] px-2 py-0.5 rounded-md">
            • Unsaved changes
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onAddStage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#f0f4f9] active:bg-[#e8f0fe] border border-[#e0e2ec] text-xs font-semibold text-[#1f1f1f] shadow-2xs transition-colors"
          title="Add a new stage to this workflow"
        >
          <Plus className="w-3.5 h-3.5 text-[#1a73e8]" />
          <span>Add Stage</span>
        </button>

        <button
          type="button"
          onClick={onAddTransition}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#f0f4f9] active:bg-[#e8f0fe] border border-[#e0e2ec] text-xs font-semibold text-[#1f1f1f] shadow-2xs transition-colors"
          title="Connect two stages with a transition arrow"
        >
          <ArrowRight className="w-3.5 h-3.5 text-[#0891b2]" />
          <span>Add Transition</span>
        </button>

        {/* Update Workflow Button with Dropdown */}
        <div className="relative inline-flex items-center shadow-2xs rounded-full" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => onUpdateWorkflow()}
            className="inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 rounded-l-full bg-[#1a73e8] hover:bg-[#0b57d0] text-white text-xs font-semibold transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Update Workflow</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-2 py-1.5 rounded-r-full bg-[#1a73e8] hover:bg-[#0b57d0] border-l border-white/20 text-white text-xs transition-colors"
            title="Update options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-[#e0e2ec] shadow-modal z-50 p-2 animate-scale-in text-xs">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#f0f4f9] flex items-center justify-between text-[#1f1f1f]"
                onClick={() => {
                  onUpdateWorkflow('ACTIVE');
                  setShowDropdown(false);
                }}
              >
                <div>
                  <div className="font-semibold text-[#137333]">Publish as Active</div>
                  <div className="text-[10px] text-[#747775]">Set workflow active for all tasks</div>
                </div>
                {status === 'ACTIVE' && <Check className="w-4 h-4 text-[#137333]" />}
              </button>

              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#f0f4f9] flex items-center justify-between text-[#1f1f1f]"
                onClick={() => {
                  onUpdateWorkflow('DRAFT');
                  setShowDropdown(false);
                }}
              >
                <div>
                  <div className="font-semibold text-[#b06000]">Save as Draft</div>
                  <div className="text-[10px] text-[#747775]">Work in progress</div>
                </div>
                {status === 'DRAFT' && <Check className="w-4 h-4 text-[#b06000]" />}
              </button>

              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#f0f4f9] flex items-center justify-between text-[#1f1f1f]"
                onClick={() => {
                  onUpdateWorkflow('INACTIVE');
                  setShowDropdown(false);
                }}
              >
                <div>
                  <div className="font-semibold text-[#5f6368]">Set Inactive</div>
                  <div className="text-[10px] text-[#747775]">Archive workflow</div>
                </div>
                {status === 'INACTIVE' && <Check className="w-4 h-4 text-[#5f6368]" />}
              </button>
            </div>
          )}
        </div>

        {hasUnsavedChanges && (
          <button
            type="button"
            onClick={onDiscardChanges}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#fce8e6] text-xs font-semibold text-[#d93025] transition-colors"
            title="Discard unsaved changes and reset canvas"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Discard Changes</span>
          </button>
        )}
      </div>
    </div>
  );
};
