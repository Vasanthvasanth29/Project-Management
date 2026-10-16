import React, { useState } from 'react';
import {
  Zap, Plus, Play, Pause, Trash2, Edit2, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, ToggleLeft, ToggleRight, Copy, Search,
  Layers, Eye, ArrowRight, Sparkles
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatDate } from '../../utils/dateUtils';
import { ScenarioPreviewModal } from './ScenarioPreviewModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { AutomationRule, AutomationTrigger, AutomationAction, AutomationCondition, AutomationConditionField, AutomationConditionOperator, Scenario } from '../../types';

interface AutomationRulesPageProps {
  projectId: string;
}

const TRIGGER_OPTIONS: { value: AutomationTrigger; label: string; icon: string }[] = [
  { value: 'TASK_CREATED', label: 'Task Created', icon: '📋' },
  { value: 'TASK_STATUS_CHANGED', label: 'Status Changed', icon: '🔄' },
  { value: 'TASK_ASSIGNED', label: 'Task Assigned', icon: '👤' },
  { value: 'TASK_OVERDUE', label: 'Task Overdue', icon: '⏰' },
  { value: 'TASK_DONE', label: 'Task Completed', icon: '✅' },
  { value: 'SPRINT_STARTED', label: 'Iteration Started', icon: '🚀' },
  { value: 'SPRINT_COMPLETED', label: 'Iteration Completed', icon: '🎯' },
  { value: 'DEPENDENCY_BLOCKED', label: 'Dependency Blocked', icon: '🔗' },
  { value: 'RELEASE_STARTED', label: 'Release Started', icon: '📦' },
  { value: 'RELEASE_COMPLETED', label: 'Release Completed', icon: '🎉' },
];

const ACTION_OPTIONS: { value: AutomationAction; label: string; icon: string }[] = [
  { value: 'CHANGE_STATUS', label: 'Change Status', icon: '🔄' },
  { value: 'CHANGE_PRIORITY', label: 'Change Priority', icon: '🎯' },
  { value: 'ASSIGN_USER', label: 'Assign User', icon: '👤' },
  { value: 'ASSIGN_TEAM', label: 'Assign Team', icon: '👥' },
  { value: 'UPDATE_SPRINT_PROGRESS', label: 'Update Iteration Progress', icon: '📊' },
  { value: 'UPDATE_PROJECT_PROGRESS', label: 'Update Project Progress', icon: '📈' },
  { value: 'NOTIFY_ASSIGNEE', label: 'Notify Assignee', icon: '🔔' },
  { value: 'NOTIFY_TEAM_LEAD', label: 'Notify Team Lead', icon: '📢' },
  { value: 'ADD_NOTIFICATION', label: 'Add Notification', icon: '💬' },
  { value: 'LOG_ACTIVITY', label: 'Log Activity', icon: '📝' },
];

const CONDITION_FIELDS: { value: AutomationConditionField; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assigneeId', label: 'Assignee' },
  { value: 'teamId', label: 'Team' },
  { value: 'sprintId', label: 'Iteration' },
  { value: 'releaseId', label: 'Release' },
  { value: 'storyPoints', label: 'Story Points' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'type', label: 'Task Type' },
];

const OPERATORS: { value: AutomationConditionOperator; label: string }[] = [
  { value: 'EQUALS', label: 'equals' },
  { value: 'NOT_EQUALS', label: 'not equals' },
  { value: 'GREATER_THAN', label: 'greater than' },
  { value: 'LESS_THAN', label: 'less than' },
  { value: 'CONTAINS', label: 'contains' },
];

export const AutomationRulesPage: React.FC<AutomationRulesPageProps> = ({ projectId }) => {
  const { automationRules, automationExecutions, createAutomationRule, toggleAutomationRule, deleteAutomationRule, executeAutomationRule, users, teams, sprints, releases, scenarios, deleteScenario } = useAppStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showExecHistory, setShowExecHistory] = useState<string | null>(null);
  const [previewScenario, setPreviewScenario] = useState<Scenario | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'rule' | 'scenario'; id: string; name: string } | null>(null);

  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState<AutomationTrigger>('TASK_STATUS_CHANGED');
  const [ruleConditions, setRuleConditions] = useState<AutomationCondition[]>([]);
  const [ruleActions, setRuleActions] = useState<AutomationAction[]>([]);

  const projectRules = automationRules.filter((r) => r.projectId === projectId);

  const resetForm = () => {
    setRuleName('');
    setRuleDesc('');
    setRuleTrigger('TASK_STATUS_CHANGED');
    setRuleConditions([]);
    setRuleActions([]);
    setShowCreate(false);
    setEditingRule(null);
  };

  const handleCreateRule = () => {
    if (!ruleName.trim()) return;
    createAutomationRule({
      projectId,
      name: ruleName,
      description: ruleDesc,
      trigger: ruleTrigger,
      conditions: ruleConditions,
      actions: ruleActions,
      enabled: true,
      executionCount: 0,
    });
    resetForm();
  };

  const handleTestRule = (ruleId: string) => {
    executeAutomationRule(ruleId, 'TASK_CREATED', { type: 'task', id: 'test-001' }, 0, []);
  };

  const addCondition = () => {
    setRuleConditions([...ruleConditions, { field: 'status', operator: 'EQUALS', value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    setRuleConditions(ruleConditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCondition = (index: number) => {
    setRuleConditions(ruleConditions.filter((_, i) => i !== index));
  };

  const toggleAction = (action: AutomationAction) => {
    setRuleActions(ruleActions.includes(action) ? ruleActions.filter((a) => a !== action) : [...ruleActions, action]);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#0d9488]">{projectRules.length}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Total Rules</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#10b981]">{projectRules.filter((r) => r.enabled).length}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Active</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#6366f1]">{automationExecutions.filter((e) => e.ruleId && projectRules.some((r) => r.id === e.ruleId)).length}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Executions</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-[#f59e0b]">{scenarios.filter((s) => s.projectId === projectId).length}</div>
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Scenarios</div>
        </div>
      </div>

      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f59e0b]" /> Automation Studio
            </h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">Visual workflow automation — WHEN something happens, IF conditions match, THEN perform actions</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary btn-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </button>
        </div>
      </div>

      {/* Visual Builder Form */}
      {(showCreate || editingRule) && (
        <div className="card p-6 border-2 border-[#0d9488]/30 animate-slide-in">
          <h3 className="text-xs font-bold text-[#0d9488] mb-5 flex items-center gap-2">
            <Zap className="w-4 h-4" /> {editingRule ? 'Edit Rule' : 'Build New Rule'}
          </h3>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name..." className="input text-xs" />
            <input type="text" value={ruleDesc} onChange={(e) => setRuleDesc(e.target.value)} placeholder="Description (optional)..." className="input text-xs" />
          </div>

          {/* Visual WHEN → IF → THEN Builder */}
          <div className="space-y-4">
            {/* WHEN (Trigger) */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-[#0d9488] text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-[#0d9488]/30">WHEN</div>
                <div className="w-0.5 h-8 bg-[#0d9488]/20 mt-1" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5 block">Event Trigger</label>
                <div className="grid grid-cols-5 gap-2">
                  {TRIGGER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRuleTrigger(opt.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                        ruleTrigger === opt.value
                          ? 'bg-[#0d9488]/10 border-[#0d9488]/50 text-[#0d9488] shadow-sm'
                          : 'bg-white border-[#e2e5ea] text-[#6b7280] hover:border-[#0d9488]/30 hover:bg-[#f8f9fb]'
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* IF (Conditions) */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-[#f59e0b]/30">IF</div>
                <div className="w-0.5 h-8 bg-[#f59e0b]/20 mt-1" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Conditions</label>
                  <button onClick={addCondition} className="text-[10px] text-[#0d9488] font-semibold hover:underline">+ Add Condition</button>
                </div>
                {ruleConditions.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-[#d1d5db] text-xs text-[#9ca3af] text-center">
                    No conditions — rule triggers on every event
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ruleConditions.map((cond, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-[#fffbeb]/50 rounded-xl border border-[#f59e0b]/20">
                        <span className="text-[9px] font-bold text-[#f59e0b] w-6">IF</span>
                        <select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value as AutomationConditionField })} className="input text-xs flex-1">
                          {CONDITION_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                        <select value={cond.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as AutomationConditionOperator })} className="input text-xs flex-1">
                          {OPERATORS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <input type="text" value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="Value" className="input text-xs flex-1" />
                        <button onClick={() => removeCondition(i)} className="p-1 text-[#ef4444] hover:text-[#dc2626]"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* THEN (Actions) */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1] text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-[#6366f1]/30">THEN</div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5 block">Actions</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTION_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition-all ${
                        ruleActions.includes(opt.value)
                          ? 'bg-[#6366f1]/10 border-[#6366f1]/40 text-[#6366f1]'
                          : 'bg-white border-[#e2e5ea] text-[#6b7280] hover:border-[#6366f1]/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ruleActions.includes(opt.value)}
                        onChange={() => toggleAction(opt.value)}
                        className="w-3.5 h-3.5 rounded border-[#d1d5db]"
                      />
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-[#f1f3f4]">
            <button onClick={resetForm} className="btn-secondary btn-xs">Cancel</button>
            <button onClick={handleCreateRule} className="btn-primary btn-xs" disabled={!ruleName.trim()}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#f1f3f4]">
          <h3 className="text-xs font-bold text-[#1a1d23]">Active Rules ({projectRules.length})</h3>
        </div>
        <div className="divide-y divide-[#f1f3f4]">
          {projectRules.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f59e0b]/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-[#f59e0b]" />
              </div>
              <p className="text-xs font-bold text-[#1a1d23]">No automation rules yet</p>
              <p className="text-[10px] text-[#9ca3af] mt-1">Create your first rule to automate workflow actions</p>
            </div>
          ) : (
            projectRules.map((rule) => {
              const ruleExecutions = automationExecutions.filter((e) => e.ruleId === rule.id);
              const successCount = ruleExecutions.filter((e) => e.success).length;
              const failCount = ruleExecutions.filter((e) => !e.success).length;
              const isExpanded = expandedRule === rule.id;
              const isExecHistoryOpen = showExecHistory === rule.id;

              return (
                <div key={rule.id} className={`p-4 ${!rule.enabled ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button onClick={() => setExpandedRule(isExpanded ? null : rule.id)} className="text-[#9ca3af] hover:text-[#1a1d23]">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="w-8 h-8 rounded-lg bg-[#0d9488]/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-[#0d9488]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1a1d23]">{rule.name}</div>
                        <div className="text-[10px] text-[#9ca3af]">
                          {TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.icon}{' '}
                          {TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.label || rule.trigger}
                          {rule.description && ` · ${rule.description}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-[10px] text-[#9ca3af] text-right">
                        <div>{rule.executionCount} runs</div>
                        <div className="flex gap-1">
                          <span className="text-[#10b981]">{successCount} ok</span>
                          {failCount > 0 && <span className="text-[#ef4444]">{failCount} fail</span>}
                        </div>
                      </div>
                      {rule.lastExecutedAt && (
                        <div className="text-[9px] text-[#9ca3af]">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {formatDate(rule.lastExecutedAt)}
                        </div>
                      )}
                      <button onClick={() => toggleAutomationRule(rule.id)} className={`p-1 rounded ${rule.enabled ? 'text-[#10b981]' : 'text-[#9ca3af]'}`}>
                        {rule.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => handleTestRule(rule.id)} className="p-1 text-[#9ca3af] hover:text-[#6366f1]" title="Test rule">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setShowExecHistory(showExecHistory ? null : rule.id)} className="p-1 text-[#9ca3af] hover:text-[#1a1d23]" title="Execution history">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete({ type: 'rule', id: rule.id, name: rule.name })} className="p-1 text-[#9ca3af] hover:text-[#ef4444]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Visual Preview */}
                  {isExpanded && (
                    <div className="mt-3 ml-11">
                      <div className="p-3 rounded-xl bg-[#f8f9fb] border border-[#e2e5ea]">
                        <div className="flex items-center gap-2 text-[10px] font-bold mb-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#0d9488] text-white">WHEN</span>
                          <span className="text-[#9ca3af]">{TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.label}</span>
                          <ArrowRight className="w-3 h-3 text-[#9ca3af]" />
                          {rule.conditions.length > 0 && (
                            <>
                              <span className="px-2 py-0.5 rounded-md bg-[#f59e0b] text-white">IF</span>
                              <span className="text-[#9ca3af]">{rule.conditions.length} condition(s)</span>
                              <ArrowRight className="w-3 h-3 text-[#9ca3af]" />
                            </>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-[#6366f1] text-white">THEN</span>
                          <span className="text-[#9ca3af]">{rule.actions.length} action(s)</span>
                        </div>
                        {rule.conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rule.conditions.map((c, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-medium">
                                {c.field} {c.operator.toLowerCase()} {c.value || '(any)'}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rule.actions.map((a) => (
                            <span key={a} className="px-2 py-0.5 rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-[10px] font-medium">
                              {ACTION_OPTIONS.find((opt) => opt.value === a)?.icon} {ACTION_OPTIONS.find((opt) => opt.value === a)?.label || a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Execution History */}
                  {isExecHistoryOpen && (
                    <div className="mt-3 ml-11">
                      <div className="text-[10px] font-bold text-[#9ca3af] mb-1">Recent Executions:</div>
                      {ruleExecutions.length === 0 ? (
                        <p className="text-[10px] text-[#9ca3af] italic">No executions yet</p>
                      ) : (
                        <div className="divide-y divide-[#f1f3f4] rounded-xl border border-[#e2e5ea] max-h-40 overflow-y-auto">
                          {ruleExecutions.slice(0, 10).map((exec) => (
                            <div key={exec.id} className={`px-3 py-1.5 text-[10px] flex items-center justify-between ${!exec.success ? 'bg-[#fef2f2]' : ''}`}>
                              <div className="flex items-center gap-2">
                                {exec.success ? <CheckCircle className="w-3 h-3 text-[#10b981]" /> : <XCircle className="w-3 h-3 text-[#ef4444]" />}
                                <span className="text-[#6b7280]">{exec.triggeredEntityType}: {exec.triggeredEntityId}</span>
                                {exec.message && (
                                  <span className="text-[9px] text-[#ef4444] font-medium truncate max-w-[200px]" title={exec.message}>
                                    ({exec.message.substring(0, 50)}...)
                                  </span>
                                )}
                              </div>
                              <span className="text-[#9ca3af]">{formatDate(exec.executedAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Scenarios Section */}
      {scenarios.filter((s) => s.projectId === projectId).length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#f1f3f4]">
            <h3 className="text-xs font-bold text-[#1a1d23] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8b5cf6]" /> Scenario Plans ({scenarios.filter((s) => s.projectId === projectId).length})
            </h3>
            <p className="text-[10px] text-[#9ca3af] mt-0.5">Preview and apply planned changes</p>
          </div>
          <div className="divide-y divide-[#f1f3f4]">
            {scenarios.filter((s) => s.projectId === projectId).map((scenario) => (
              <div key={scenario.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#f8f9fb] transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#1a1d23]">{scenario.name}</div>
                  <div className="text-[10px] text-[#9ca3af]">
                    {scenario.changes.length} change{scenario.changes.length !== 1 ? 's' : ''} · Created {formatDate(scenario.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPreviewScenario(scenario)}
                    className="btn-secondary btn-xs flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: 'scenario', id: scenario.id, name: scenario.name })}
                    className="p-1 text-[#9ca3af] hover:text-[#ef4444]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario Preview Modal */}
      {previewScenario && (
        <ScenarioPreviewModal
          scenario={previewScenario}
          isOpen={true}
          onClose={() => setPreviewScenario(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            if (confirmDelete.type === 'rule') {
              deleteAutomationRule(confirmDelete.id);
            } else {
              deleteScenario(confirmDelete.id);
            }
          }
          setConfirmDelete(null);
        }}
        title={confirmDelete?.type === 'rule' ? 'Delete Automation Rule' : 'Delete Scenario'}
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
};
