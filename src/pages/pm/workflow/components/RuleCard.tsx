import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, MessageSquare, CheckSquare, Zap, Plus, Trash2 } from 'lucide-react';
import type { WorkflowTransitionRule } from '../../../../types';

interface RuleCardProps {
  rule: WorkflowTransitionRule;
  onUpdate: (updates: Partial<WorkflowTransitionRule>) => void;
  onDelete?: () => void;
}

const getRuleIcon = (type: WorkflowTransitionRule['type']) => {
  switch (type) {
    case 'restrict':
      return <Shield className="w-4 h-4 text-[#1a73e8]" />;
    case 'request_input':
      return <MessageSquare className="w-4 h-4 text-[#0891b2]" />;
    case 'validate':
      return <CheckSquare className="w-4 h-4 text-[#059669]" />;
    case 'perform_action':
      return <Zap className="w-4 h-4 text-[#f59e0b]" />;
    default:
      return <Shield className="w-4 h-4 text-[#747775]" />;
  }
};

export const RuleCard: React.FC<RuleCardProps> = ({ rule, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[#e0e2ec] bg-white shadow-2xs overflow-hidden transition-all">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#f8fafd] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#f0f4f9] flex items-center justify-center flex-shrink-0">
            {getRuleIcon(rule.type)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#1f1f1f] truncate font-display">{rule.title}</div>
            <div className="text-[10px] text-[#747775] truncate">{rule.description || 'Configured rule'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle Switch */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ enabled: !rule.enabled });
            }}
            className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
              rule.enabled ? 'bg-[#1a73e8]' : 'bg-[#c4c7c5]'
            }`}
            title={rule.enabled ? 'Rule enabled' : 'Rule disabled'}
          >
            <div
              className={`bg-white w-3.5 h-3.5 rounded-full shadow-xs transform transition-transform ${
                rule.enabled ? 'translate-x-3.5' : 'translate-x-0'
              }`}
            />
          </button>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#747775]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#747775]" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-3 border-t border-[#f1f3f4] bg-[#f8fafd] space-y-3 animate-fade-in text-xs">
          {rule.type === 'restrict' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#444746]">Allowed Roles / Groups</label>
              <select
                className="select text-xs py-1.5"
                value={rule.config?.role || 'ALL'}
                onChange={(e) => onUpdate({ config: { ...rule.config, role: e.target.value } })}
              >
                <option value="ALL">All project contributors</option>
                <option value="LEADERS">Team Leaders & Project Managers only</option>
                <option value="ADMIN">Admins only</option>
                <option value="QA">Assigned QA members only</option>
              </select>
              <p className="text-[10px] text-[#747775]">Only selected roles will see this transition button.</p>
            </div>
          )}

          {rule.type === 'request_input' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#444746]">Required Prompt / Fields</label>
              <input
                type="text"
                placeholder="e.g. Resolution comment, root cause..."
                className="input text-xs py-1.5"
                value={rule.config?.prompt || ''}
                onChange={(e) => onUpdate({ config: { ...rule.config, prompt: e.target.value } })}
              />
              <p className="text-[10px] text-[#747775]">Users must fill this input before completing the transition.</p>
            </div>
          )}

          {rule.type === 'validate' && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#444746]">Validation Criteria</label>
              <div className="space-y-1 text-[#444746]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.config?.requireSubtasks !== false}
                    onChange={(e) => onUpdate({ config: { ...rule.config, requireSubtasks: e.target.checked } })}
                    className="rounded text-[#1a73e8]"
                  />
                  <span>All subtasks must be resolved</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.config?.requireAssignee !== false}
                    onChange={(e) => onUpdate({ config: { ...rule.config, requireAssignee: e.target.checked } })}
                    className="rounded text-[#1a73e8]"
                  />
                  <span>Task must have an assignee</span>
                </label>
              </div>
            </div>
          )}

          {rule.type === 'perform_action' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#444746]">Automated Action</label>
              <select
                className="select text-xs py-1.5"
                value={rule.config?.action || 'NOTIFY_LEAD'}
                onChange={(e) => onUpdate({ config: { ...rule.config, action: e.target.value } })}
              >
                <option value="NOTIFY_LEAD">Notify Responsible Team Leader</option>
                <option value="NOTIFY_ALL">Notify all project watchers</option>
                <option value="AUTO_ASSIGN">Assign to stage responsible member</option>
                <option value="CLEAR_ASSIGNEE">Clear assignee</option>
              </select>
            </div>
          )}

          {onDelete && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-[#d93025] hover:text-[#b3261e] font-semibold"
                onClick={onDelete}
              >
                <Trash2 className="w-3 h-3" />
                Remove Rule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
