import React from 'react';
import { AlertTriangle, AlertCircle, Info, AlertOctagon, ArrowRight, Eye, ShieldCheck, Zap, Target, Link2, Clock } from 'lucide-react';
import type { ProjectSignal, SignalType, SignalSeverity, SignalConfidence } from './computeProjectSignals';

const severityConfig: Record<SignalSeverity, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: AlertOctagon, color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: 'Critical' },
  high: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'High' },
  medium: { icon: AlertCircle, color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', label: 'Medium' },
  low: { icon: Info, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: 'Low' },
};

const confidenceConfig: Record<SignalConfidence, { color: string; bg: string; label: string }> = {
  high: { color: '#059669', bg: '#d1fae5', label: 'High Confidence' },
  medium: { color: '#d97706', bg: '#fef3c7', label: 'Medium Confidence' },
  low: { color: '#dc2626', bg: '#fee2e2', label: 'Low Confidence' },
};

const typeConfig: Record<SignalType, { icon: React.ElementType; label: string; color: string }> = {
  'delivery-risk': { icon: Target, label: 'Delivery Risk', color: '#dc2626' },
  'sprint-completion': { icon: Zap, label: 'Iteration Completion', color: '#7c3aed' },
  'workload-pressure': { icon: AlertTriangle, label: 'Workload Pressure', color: '#d97706' },
  'quality-risk': { icon: ShieldCheck, label: 'Quality Risk', color: '#2563eb' },
  'dependency-risk': { icon: Link2, label: 'Dependency Risk', color: '#ea580c' },
  'deadline-pressure': { icon: Clock, label: 'Deadline Pressure', color: '#0891b2' },
};

interface SignalCardProps {
  signal: ProjectSignal;
  onNavigate: (type: string, id?: string, tab?: string) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, onNavigate }) => {
  const sevCfg = severityConfig[signal.severity];
  const confCfg = confidenceConfig[signal.confidence];
  const typeCfg = typeConfig[signal.type];
  const SevIcon = sevCfg.icon;
  const TypeIcon = typeCfg.icon;

  return (
    <div
      className="p-4 rounded-xl border transition-colors hover:shadow-sm"
      style={{ backgroundColor: `${sevCfg.bg}20`, borderColor: sevCfg.border }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: sevCfg.bg }}
        >
          <SevIcon className="w-4 h-4" style={{ color: sevCfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-xs font-bold" style={{ color: sevCfg.color }}>{signal.title}</h4>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
              style={{ color: sevCfg.color, backgroundColor: sevCfg.bg }}
            >
              {sevCfg.label}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: confCfg.color, backgroundColor: confCfg.bg }}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              {confCfg.label}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: typeCfg.color, backgroundColor: `${typeCfg.color}15` }}
            >
              <TypeIcon className="w-2.5 h-2.5" />
              {typeCfg.label}
            </span>
          </div>

          <div className="space-y-1.5 mt-2">
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider w-16 flex-shrink-0 pt-0.5">Evidence</span>
              <span className="text-[10px] text-[#4b5563] leading-relaxed">{signal.evidence}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#d97706] uppercase tracking-wider w-16 flex-shrink-0 pt-0.5">Likely Outcome</span>
              <span className="text-[10px] text-[#4b5563] leading-relaxed">{signal.likelyOutcome}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-[#059669] uppercase tracking-wider w-16 flex-shrink-0 pt-0.5">Prevention</span>
              <span className="text-[10px] text-[#4b5563] leading-relaxed">{signal.prevention}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#f1f5f9]">
            <div className="flex flex-wrap gap-x-3 text-[10px] text-[#9ca3af]">
              <span><span className="font-semibold text-[#6b7280]">Affected:</span> {signal.affectedItem}</span>
            </div>
            <button
              onClick={() => onNavigate(signal.navigationTarget.type, signal.navigationTarget.id, signal.navigationTarget.tab)}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: sevCfg.color, backgroundColor: sevCfg.bg }}
            >
              {signal.navigationTarget.type === 'task' && 'Open Task'}
              {signal.navigationTarget.type === 'sprint' && 'Open Iteration'}
              {signal.navigationTarget.type === 'bug' && 'Open Bug'}
              {signal.navigationTarget.type === 'member' && 'View Team'}
              {signal.navigationTarget.type === 'project' && 'Open Project'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProjectSignalsProps {
  signals: ProjectSignal[];
  onNavigate: (type: string, id?: string, tab?: string) => void;
}

export const ProjectSignals: React.FC<ProjectSignalsProps> = ({ signals, onNavigate }) => {
  if (signals.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f5f9]">
          <Eye className="w-4 h-4 text-[#059669]" />
          <h2 className="text-sm font-bold text-[#1a1d23]">Project Signals</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#d1fae5] flex items-center justify-center mb-3">
            <Eye className="w-6 h-6 text-[#059669]" />
          </div>
          <p className="text-sm font-medium text-[#1a1d23] mb-1">Not enough project data to generate reliable signals</p>
          <p className="text-xs text-[#9ca3af] max-w-xs">
            Add more tasks, iterations, or bug reports to enable predictive analysis. Signals require active project data to detect patterns.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#7c3aed]" />
          <h2 className="text-sm font-bold text-[#1a1d23]">Project Signals</h2>
          <span className="text-[10px] text-[#9ca3af] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
            {signals.length} signal{signals.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[10px] text-[#9ca3af]">What is likely to happen next</span>
      </div>

      <div className="space-y-3">
        {signals.map(signal => (
          <SignalCard key={signal.id} signal={signal} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
};
