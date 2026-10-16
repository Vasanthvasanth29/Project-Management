import React, { useState } from 'react';
import {
  AlertTriangle, AlertCircle, Users, Bug, Link2, TrendingUp,
  ChevronDown, ChevronRight, ArrowRight, CheckCircle2,
  Clock, Zap, Shield,
} from 'lucide-react';
import type {
  DecisionTimelineItem,
  DecisionTimelineSnapshot,
  TimelineEventType,
  TimelineSeverity,
} from './computeDecisionTimeline';
import { isValidDate } from '../../../utils/calculationUtils';

interface DecisionTimelineProps {
  snapshot: DecisionTimelineSnapshot;
  onNavigate: (type: string, targetId?: string, tab?: string) => void;
}

const severityConfig: Record<TimelineSeverity, {
  color: string;
  bg: string;
  border: string;
  ring: string;
  icon: React.ReactNode;
  label: string;
}> = {
  critical: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    ring: 'ring-red-200',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: 'Critical',
  },
  high: {
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    ring: 'ring-orange-200',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'High',
  },
  medium: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'Medium',
  },
  low: {
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    ring: 'ring-slate-200',
    icon: <Zap className="w-3.5 h-3.5" />,
    label: 'Low',
  },
  positive: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'Positive',
  },
};

const typeConfig: Record<TimelineEventType, {
  icon: React.ReactNode;
  label: string;
}> = {
  'delivery-signal': {
    icon: <TrendingUp className="w-3 h-3" />,
    label: 'Delivery',
  },
  'risk-escalation': {
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Risk',
  },
  'workload-shift': {
    icon: <Users className="w-3 h-3" />,
    label: 'Workload',
  },
  'quality-signal': {
    icon: <Bug className="w-3 h-3" />,
    label: 'Quality',
  },
  'dependency-signal': {
    icon: <Link2 className="w-3 h-3" />,
    label: 'Dependency',
  },
  'sprint-outlook': {
    icon: <Clock className="w-3 h-3" />,
    label: 'Iteration',
  },
  'positive-signal': {
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: 'Positive',
  },
};

const outlookDisplay: Record<string, { label: string; color: string; bg: string }> = {
  'on-track': { label: 'On Track', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  'watch': { label: 'Watch', color: 'text-amber-700', bg: 'bg-amber-100' },
  'at-risk': { label: 'At Risk', color: 'text-red-700', bg: 'bg-red-100' },
};

const SnapshotHeader: React.FC<{ snapshot: DecisionTimelineSnapshot }> = ({ snapshot }) => {
  const outlook = outlookDisplay[snapshot.outlook] ?? outlookDisplay['watch'];
  const highestSev = severityConfig[snapshot.highestSeverity];

  return (
    <div className="card p-4 border border-[#e2e5ea]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1a1d23] font-display">Project Decision Snapshot</h3>
            <p className="text-[10px] text-[#9ca3af] mt-0.5">Derived from current project data</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${outlook.color} ${outlook.bg}`}>
            {outlook.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#4b5563] bg-[#f1f5f9]">
            {snapshot.activeSignals} active signal{snapshot.activeSignals !== 1 ? 's' : ''}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${highestSev.color} ${highestSev.bg}`}>
            Highest: {highestSev.label}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[#e2e5ea]">
        <p className="text-[10px] text-[#6b7280]">
          <span className="font-semibold text-[#4b5563]">Do this first: </span>
          {snapshot.mostImportantDecision}
        </p>
      </div>
    </div>
  );
};

const TimelineItem: React.FC<{
  item: DecisionTimelineItem;
  onNavigate: (type: string, targetId?: string, tab?: string) => void;
  isLast: boolean;
}> = ({ item, onNavigate, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const sev = severityConfig[item.severity];
  const type = typeConfig[item.type];

  return (
    <div className="relative flex gap-3">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ring-4 ${sev.ring} ${
          item.isPositive ? 'bg-emerald-400' :
          item.severity === 'critical' ? 'bg-red-500' :
          item.severity === 'high' ? 'bg-orange-500' :
          item.severity === 'medium' ? 'bg-amber-400' :
          'bg-slate-400'
        }`} />
        {!isLast && <div className="w-px flex-1 bg-[#e2e5ea] min-h-[24px]" />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-4 rounded-xl border ${sev.border} ${sev.bg} overflow-hidden`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-3 flex items-start justify-between gap-2 hover:bg-black/[0.02] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${sev.color} bg-white/60`}>
                {sev.icon}
                {sev.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] text-[#6b7280]">
                {type.icon}
                {type.label}
              </span>
              {item.timestamp && isValidDate(item.timestamp) && (
                <span className="text-[9px] text-[#9ca3af]">
                  Source: {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            <h4 className="text-[11px] font-bold text-[#1a1d23] leading-tight">{item.title}</h4>
            <p className="text-[10px] text-[#4b5563] mt-0.5 leading-snug">{item.summary}</p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af]" />
              : <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
            }
          </div>
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2 border-t border-black/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-0.5">Evidence</p>
                <p className="text-[10px] text-[#4b5563] leading-snug">{item.evidence}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-0.5">Impact</p>
                <p className="text-[10px] text-[#4b5563] leading-snug">{item.impact}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-0.5">Decision</p>
                <p className="text-[10px] text-[#4b5563] leading-snug">{item.decision}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-0.5">Likely Outcome</p>
                <p className="text-[10px] text-[#4b5563] leading-snug">{item.likelyOutcome}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(item.navigationTarget.type, item.navigationTarget.id, item.navigationTarget.tab);
              }}
              className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-white/80 border border-[#e2e5ea] text-[10px] font-semibold text-[#0d9488] hover:bg-white transition-colors"
            >
              {item.navigationTarget.type === 'task' ? 'Open Task' :
               item.navigationTarget.type === 'sprint' ? 'Open Iteration' :
               item.navigationTarget.type === 'bug' ? 'View Bugs' :
               item.navigationTarget.type === 'member' ? 'View Team' :
               'Open Project'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="card p-8 text-center border border-[#e2e5ea]">
    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    </div>
    <h3 className="text-sm font-bold text-[#1a1d23] mb-1 font-display">Project is currently stable</h3>
    <p className="text-xs text-[#6b7280] max-w-sm mx-auto">
      No significant decision signals were detected from the available project data.
    </p>
    <p className="text-[9px] text-[#9ca3af] mt-3 italic">
      Derived from current project data.
    </p>
  </div>
);

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ snapshot, onNavigate }) => {
  if (snapshot.items.length === 0) {
    return (
      <div className="space-y-3">
        <SnapshotHeader snapshot={snapshot} />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SnapshotHeader snapshot={snapshot} />
      <div className="card p-4 border border-[#e2e5ea]">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xs font-bold text-[#1a1d23] font-display">Decision Timeline</h3>
          <span className="text-[9px] text-[#9ca3af] italic">Derived from current project data</span>
        </div>
        <div className="space-y-0">
          {snapshot.items.map((item, idx) => (
            <TimelineItem
              key={item.id}
              item={item}
              onNavigate={onNavigate}
              isLast={idx === snapshot.items.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
