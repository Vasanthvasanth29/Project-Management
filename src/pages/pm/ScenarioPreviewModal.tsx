import React, { useMemo } from 'react';
import { X, ArrowRight, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import type { Scenario, ScenarioChange } from '../../types';

interface ScenarioPreviewModalProps {
  scenario: Scenario;
  isOpen: boolean;
  onClose: () => void;
}

const ENTITY_LABELS: Record<string, string> = {
  task: 'Task',
  sprint: 'Iteration',
  release: 'Release',
};

export const ScenarioPreviewModal: React.FC<ScenarioPreviewModalProps> = ({
  scenario,
  isOpen,
  onClose,
}) => {
  const { tasks, sprints, releases, applyScenario } = useAppStore();

  const enrichedChanges = useMemo(() => {
    return scenario.changes.map((change) => {
      let entityName = change.entityId;
      if (change.entityType === 'task') {
        const task = tasks.find((t) => t.id === change.entityId);
        entityName = task?.title || change.entityId;
      } else if (change.entityType === 'sprint') {
        const sprint = sprints.find((s) => s.id === change.entityId);
        entityName = sprint?.name || change.entityId;
      } else if (change.entityType === 'release') {
        const release = releases.find((r) => r.id === change.entityId);
        entityName = release?.name || change.entityId;
      }
      return { ...change, entityName } as ScenarioChange & { entityName: string };
    });
  }, [scenario.changes, tasks, sprints, releases]);

  const groupedChanges = useMemo(() => {
    const groups = new Map<string, (ScenarioChange & { entityName: string })[]>();
    enrichedChanges.forEach((change) => {
      const key = `${change.entityType}:${change.entityId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(change);
    });
    return Array.from(groups.entries());
  }, [enrichedChanges]);

  const handleApply = () => {
    applyScenario(scenario.id);
    toast.success(`Scenario "${scenario.name}" applied successfully`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Scenario Preview: {scenario.name}</h2>
              <p className="text-xs text-slate-500">{scenario.description || 'Review changes before applying'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-800">
              This will modify <strong>{scenario.changes.length} field{scenario.changes.length !== 1 ? 's' : ''}</strong> across <strong>{groupedChanges.length} entit{groupedChanges.length !== 1 ? 'ies' : 'y'}</strong>. Review carefully before confirming.
            </span>
          </div>

          {groupedChanges.map(([key, changes]) => {
            const firstChange = changes[0] as ScenarioChange & { entityName: string };
            return (
              <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                    {ENTITY_LABELS[firstChange.entityType] || firstChange.entityType}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{firstChange.entityName}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {changes.map((change, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-4 text-xs">
                      <div className="w-28 flex-shrink-0">
                        <span className="font-semibold text-slate-600">{change.field}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1 p-2 rounded-lg bg-red-50 border border-red-100">
                          <div className="text-[9px] font-bold text-red-500 uppercase mb-0.5">Before</div>
                          <div className="text-xs font-medium text-red-800">{String(change.oldValue) || '(empty)'}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 p-2 rounded-lg bg-green-50 border border-green-100">
                          <div className="text-[9px] font-bold text-green-500 uppercase mb-0.5">After</div>
                          <div className="text-xs font-medium text-green-800">{String(change.newValue) || '(empty)'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {scenario.changes.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No changes configured in this scenario.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleApply}
            disabled={scenario.changes.length === 0}
            className={`btn-sm text-xs flex items-center gap-1.5 ${
              scenario.changes.length > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Apply Changes ({scenario.changes.length})
          </button>
        </div>
      </div>
    </div>
  );
};
