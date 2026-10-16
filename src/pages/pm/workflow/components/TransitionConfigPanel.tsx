import React, { useState } from 'react';
import { X, ArrowRight, Trash2, Plus, Zap, Shield, MessageSquare, CheckSquare } from 'lucide-react';
import { RuleCard } from './RuleCard';
import { DEFAULT_RULES } from '../types';
import type { WorkflowTransition, WorkflowTransitionRule } from '../../../../types';

interface TransitionConfigPanelProps {
  transition: WorkflowTransition;
  fromName: string;
  toName: string;
  onUpdateTransition: (updates: Partial<WorkflowTransition>) => void;
  onDeleteTransition: (transitionId: string) => void;
  onClose: () => void;
}

export const TransitionConfigPanel: React.FC<TransitionConfigPanelProps> = ({
  transition,
  fromName,
  toName,
  onUpdateTransition,
  onDeleteTransition,
  onClose,
}) => {
  const [showAddRuleMenu, setShowAddRuleMenu] = useState(false);
  const [showTriggerInput, setShowTriggerInput] = useState(false);
  const [newTriggerName, setNewTriggerName] = useState('');

  const rules = transition.rules || [];

  const handleAddRule = (template: typeof DEFAULT_RULES[0]) => {
    const newRule: WorkflowTransitionRule = {
      id: `rule-${Date.now()}`,
      type: template.type,
      title: template.title,
      description: template.description,
      enabled: true,
      config: template.defaultConfig || {},
    };

    onUpdateTransition({
      rules: [...rules, newRule],
    });
    setShowAddRuleMenu(false);
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<WorkflowTransitionRule>) => {
    const updatedRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r));
    onUpdateTransition({ rules: updatedRules });
  };

  const handleDeleteRule = (ruleId: string) => {
    const filteredRules = rules.filter((r) => r.id !== ruleId);
    onUpdateTransition({ rules: filteredRules });
  };

  return (
    <div className="h-full flex flex-col bg-white border border-[#e0e2ec] rounded-3xl shadow-sm overflow-hidden animate-slide-in">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Transition</span>
            <h3 className="text-sm font-bold text-[#1f1f1f] truncate font-display">
              {fromName} → {toName}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-[#e0e2ec] text-[#747775] transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Path Indicator Card */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Path</label>
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#f0f4f9] border border-[#e0e2ec] text-xs font-semibold text-[#1f1f1f]">
            <span className="px-2.5 py-1 rounded-xl bg-white shadow-2xs border border-[#e0e2ec] truncate max-w-[110px]">
              {fromName}
            </span>
            <ArrowRight className="w-4 h-4 text-[#1a73e8] flex-shrink-0" />
            <span className="px-2.5 py-1 rounded-xl bg-white shadow-2xs border border-[#e0e2ec] truncate max-w-[110px]">
              {toName}
            </span>
          </div>
        </div>

        {/* Rules Section */}
        <div className="space-y-2 pt-2 border-t border-[#f1f3f4]">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Transition Rules</label>
              <p className="text-[10px] text-[#747775]">Guards, validations & automations</p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddRuleMenu(!showAddRuleMenu)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#0b57d0] text-[11px] font-semibold transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Rule</span>
              </button>

              {showAddRuleMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-[#e0e2ec] shadow-modal z-50 p-2 animate-scale-in">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-[#747775]">Select Rule Type</div>
                  {DEFAULT_RULES.map((template) => (
                    <button
                      key={template.type}
                      type="button"
                      className="w-full text-left p-2 rounded-xl hover:bg-[#f0f4f9] flex items-center gap-2 text-xs transition-colors"
                      onClick={() => handleAddRule(template)}
                    >
                      <Plus className="w-3.5 h-3.5 text-[#1a73e8]" />
                      <div>
                        <div className="font-semibold text-[#1f1f1f]">{template.title}</div>
                        <div className="text-[10px] text-[#747775] line-clamp-1">{template.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-[#e0e2ec] text-center text-[#747775] text-xs">
              <p className="font-medium text-[#444746]">No rules applied</p>
              <p className="text-[11px] text-[#747775] mt-0.5">Click "+ Add Rule" to add restriction or validation</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onUpdate={(updates) => handleUpdateRule(rule.id, updates)}
                  onDelete={() => handleDeleteRule(rule.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Triggers Section */}
        <div className="space-y-2 pt-2 border-t border-[#f1f3f4]">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Triggers</label>
              <p className="text-[10px] text-[#747775]">Auto-transition on git commits, PR merges, or CI/CD</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTriggerInput(!showTriggerInput)}
              className="p-1 rounded-full hover:bg-[#f0f4f9] text-[#1a73e8]"
              title="Add trigger"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showTriggerInput && (
            <div className="p-3 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] space-y-2 animate-slide-in">
              <input
                type="text"
                placeholder="e.g. GitHub PR Merged, Test Suite Passed..."
                value={newTriggerName}
                onChange={(e) => setNewTriggerName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#bbf7d0] text-xs"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNewTriggerName('');
                    setShowTriggerInput(false);
                  }}
                  className="px-2 py-1 text-[11px] text-[#747775]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTriggerInput(false);
                    setNewTriggerName('');
                  }}
                  className="px-2.5 py-1 bg-[#16a34a] text-white rounded-lg text-[11px] font-semibold"
                >
                  Save Trigger
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Transition Action */}
      <div className="p-4 border-t border-[#f1f3f4] bg-[#f8fafd]">
        <button
          type="button"
          onClick={() => onDeleteTransition(transition.id)}
          className="w-full py-2 px-3 rounded-xl border border-[#fce8e6] bg-white hover:bg-[#fce8e6] text-[#d93025] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Transition</span>
        </button>
      </div>
    </div>
  );
};
