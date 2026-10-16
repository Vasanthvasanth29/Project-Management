import React from 'react';
import { GitBranch, ArrowRight, AlertOctagon, AlertTriangle } from 'lucide-react';
import type { DecisionItem } from './healthCalculations';

interface DecisionCenterProps {
  decisions: DecisionItem[];
  onAction?: (type: string, targetId?: string) => void;
}

const urgencyConfig = {
  critical: { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', icon: AlertOctagon, label: 'Urgent' },
  high: { color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: AlertTriangle, label: 'High' },
  medium: { color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', icon: GitBranch, label: 'Medium' },
};

export const DecisionCenter: React.FC<DecisionCenterProps> = ({ decisions, onAction }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <GitBranch className="w-4 h-4 text-[#7c3aed]" />
          Decision Center
        </h2>
        <span className="text-[10px] font-semibold text-[#9ca3af]">Top decisions for you</span>
      </div>

      {decisions.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No decisions needed right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((dec, idx) => {
            const cfg = urgencyConfig[dec.urgency];
            const Icon = cfg.icon;
            return (
              <div
                key={dec.id}
                className="p-4 rounded-xl border transition-colors hover:shadow-sm"
                style={{ borderColor: cfg.border, backgroundColor: `${cfg.bg}30` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-lg font-bold text-[#d1d5db]">#{idx + 1}</span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-xs font-bold text-[#1a1d23]">{dec.title}</h4>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#6b7280] mb-1.5">
                      <span className="font-semibold">Impact:</span> {dec.expectedImpact}
                    </p>
                    <p className="text-[10px] text-[#9ca3af] mb-2">
                      <span className="font-semibold">Affected:</span> {dec.affectedEntity}
                    </p>
                    <button
                      onClick={() => onAction?.(dec.actionType, dec.actionTargetId)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {dec.recommendedAction}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
