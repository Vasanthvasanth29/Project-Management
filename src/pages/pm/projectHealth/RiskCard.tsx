import React from 'react';
import { AlertTriangle, AlertCircle, Info, AlertOctagon, ArrowRight } from 'lucide-react';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import type { ProjectRisk } from './healthCalculations';

const severityConfig = {
  critical: { icon: AlertOctagon, color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: 'Critical' },
  high: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'High' },
  medium: { icon: AlertCircle, color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', label: 'Medium' },
  low: { icon: Info, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: 'Low' },
};

interface RiskCardProps {
  risk: ProjectRisk;
  onAction?: (type: string, targetId?: string) => void;
}

export const RiskCard: React.FC<RiskCardProps> = ({ risk, onAction }) => {
  const config = severityConfig[risk.severity];
  const Icon = config.icon;

  return (
    <div
      className="p-4 rounded-xl border transition-colors hover:shadow-sm"
      style={{ backgroundColor: `${config.bg}30`, borderColor: config.border }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-xs font-bold" style={{ color: config.color }}>{risk.title}</h4>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              {config.label}
            </span>
            <ConfidenceIndicator confidence={risk.confidence} compact />
          </div>

          {/* Risk → Why → Impact → Action flow */}
          <div className="space-y-1.5 mt-2">
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#dc2626] uppercase tracking-wider w-10 flex-shrink-0 pt-0.5">Risk</span>
              <span className="text-[10px] text-[#4b5563] leading-relaxed">{risk.explanation}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#d97706] uppercase tracking-wider w-10 flex-shrink-0 pt-0.5">Why</span>
              <span className="text-[10px] text-[#6b7280] leading-relaxed">{risk.whyDetected}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#2563eb] uppercase tracking-wider w-10 flex-shrink-0 pt-0.5">Impact</span>
              <span className="text-[10px] text-[#6b7280] leading-relaxed">{risk.impact}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#f1f5f9]">
            <div className="flex flex-wrap gap-x-3 text-[10px] text-[#9ca3af]">
              <span><span className="font-semibold text-[#6b7280]">Affected:</span> {risk.affectedItem}</span>
            </div>
            {onAction && (
              <button
                onClick={() => onAction(risk.actionType, risk.actionTargetId)}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                style={{ color: config.color, backgroundColor: config.bg }}
              >
                {risk.suggestedAction.split(' ').slice(0, 4).join(' ')}...
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
