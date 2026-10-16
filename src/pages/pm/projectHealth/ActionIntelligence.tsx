import React, { useState } from 'react';
import {
  Zap, ArrowRight, AlertOctagon, AlertTriangle, AlertCircle, Info,
  CheckCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { ActionIntelligenceItem } from './healthCalculations';

interface ActionIntelligenceProps {
  items: ActionIntelligenceItem[];
  onAction?: (type: string, targetId?: string) => void;
}

const severityConfig = {
  critical: { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', icon: AlertOctagon, label: 'Critical' },
  high: { color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: AlertTriangle, label: 'High' },
  medium: { color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', icon: AlertCircle, label: 'Medium' },
  low: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: Info, label: 'Low' },
};

const categoryLabels: Record<string, string> = {
  'overdue-task': 'Overdue Task',
  'approaching-deadline': 'Approaching Deadline',
  'blocked-task': 'Blocked Task',
  'sprint-behind': 'Iteration Behind',
  'overloaded-member': 'Overloaded Member',
  'critical-bug': 'Critical Bug',
  'dependency-blocked': 'Dependency Blocked',
};

export const ActionIntelligence: React.FC<ActionIntelligenceProps> = ({ items, onAction }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#d1fae5] flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-[#059669]" />
        </div>
        <h3 className="text-sm font-bold text-[#1a1d23] mb-2 font-display">No Immediate Action Required</h3>
        <p className="text-xs text-[#6b7280] max-w-sm mx-auto">
          All tasks are on track, no critical risks detected, and team workload is balanced.
          Keep up the great work!
        </p>
      </div>
    );
  }

  const topItem = items[0];
  const remainingItems = items.slice(1);
  const topConfig = severityConfig[topItem.severity];
  const TopIcon = topConfig.icon;

  return (
    <div className="space-y-5">
      {/* DO THIS FIRST — Hero Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 lg:p-6 border-2"
        style={{
          borderColor: topConfig.border,
          background: topItem.severity === 'critical'
            ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 50%, #fef2f2 100%)'
            : topItem.severity === 'high'
              ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)'
              : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: topConfig.bg }}
          >
            <TopIcon className="w-5 h-5" style={{ color: topConfig.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: topConfig.color }} />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: topConfig.color }}
              >
                Do This First
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: topConfig.color, backgroundColor: topConfig.bg }}
              >
                {topConfig.label}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1a1d23] mb-1 font-display">
              {topItem.title}
            </h3>
            <p className="text-[10px] text-[#9ca3af] mb-1">
              {categoryLabels[topItem.category]} &middot; Affected: {topItem.affectedEntity}
            </p>
            <div className="space-y-1.5 mt-2 mb-3">
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-bold text-[#dc2626] uppercase tracking-wider w-10 flex-shrink-0 pt-0.5">Why</span>
                <span className="text-[10px] text-[#4b5563] leading-relaxed">{topItem.whyDetected}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-bold text-[#2563eb] uppercase tracking-wider w-10 flex-shrink-0 pt-0.5">Impact</span>
                <span className="text-[10px] text-[#4b5563] leading-relaxed">{topItem.impact}</span>
              </div>
            </div>
            <p className="text-[9px] text-[#9ca3af] italic mb-3">{topItem.priorityReason}</p>
            <button
              onClick={() => onAction?.(topItem.actionType, topItem.actionTargetId)}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              style={{
                color: topItem.severity === 'critical' ? '#fff' : topItem.severity === 'high' ? '#92400e' : '#1e40af',
                backgroundColor: topConfig.color,
              }}
            >
              {topItem.actionLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ACTION QUEUE */}
      {remainingItems.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
            <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
              <Zap className="w-4 h-4 text-[#7c3aed]" />
              Action Queue
            </h2>
            <span className="text-[10px] font-semibold text-[#9ca3af]">
              {remainingItems.length + 1} actions &middot; Sorted by priority
            </span>
          </div>

          <div className="space-y-2.5">
            {remainingItems.map((item, idx) => {
              const cfg = severityConfig[item.severity];
              const Icon = cfg.icon;
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border transition-colors hover:shadow-sm overflow-hidden"
                  style={{ borderColor: cfg.border, backgroundColor: `${cfg.bg}20` }}
                >
                  {/* Collapsed row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full flex items-center gap-3 p-3.5 text-left"
                  >
                    <span className="text-xs font-bold text-[#d1d5db] w-5 text-center flex-shrink-0">
                      #{idx + 2}
                    </span>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-bold text-[#1a1d23] truncate">{item.title}</h4>
                        <span
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-[8px] font-semibold text-[#9ca3af] flex-shrink-0">
                          {categoryLabels[item.category]}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-0 border-t border-[#f1f5f9]">
                      <div className="space-y-1.5 mt-3 mb-2">
                        <div className="flex items-start gap-1.5">
                          <span className="text-[9px] font-bold text-[#dc2626] uppercase tracking-wider w-12 flex-shrink-0 pt-0.5">Why</span>
                          <span className="text-[10px] text-[#4b5563] leading-relaxed">{item.whyDetected}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[9px] font-bold text-[#2563eb] uppercase tracking-wider w-12 flex-shrink-0 pt-0.5">Impact</span>
                          <span className="text-[10px] text-[#4b5563] leading-relaxed">{item.impact}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[9px] font-bold text-[#059669] uppercase tracking-wider w-12 flex-shrink-0 pt-0.5">Action</span>
                          <span className="text-[10px] text-[#4b5563] leading-relaxed">{item.recommendedAction}</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-[#9ca3af] italic mb-2.5">{item.priorityReason}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction?.(item.actionType, item.actionTargetId); }}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {item.actionLabel}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
