import React from 'react';
import { Clock, AlertTriangle, AlertOctagon, AlertCircle, Info } from 'lucide-react';
import type { EarlyWarningEvent } from './healthCalculations';

interface EarlyWarningTimelineProps {
  warnings: EarlyWarningEvent[];
  onNavigate?: (type: string, id?: string) => void;
}

const timeframeConfig = {
  today: { label: 'Today', color: '#dc2626', bg: '#fee2e2', icon: AlertOctagon },
  'next-2-days': { label: 'Next 2 Days', color: '#d97706', bg: '#fef3c7', icon: AlertTriangle },
  'next-7-days': { label: 'Next 7 Days', color: '#2563eb', bg: '#dbeafe', icon: AlertCircle },
  'sprint-end': { label: 'Iteration End', color: '#7c3aed', bg: '#f3e8ff', icon: Clock },
};

const severityDot = {
  critical: '#dc2626',
  high: '#d97706',
  medium: '#2563eb',
  low: '#6b7280',
};

export const EarlyWarningTimeline: React.FC<EarlyWarningTimelineProps> = ({ warnings, onNavigate }) => {
  const grouped = warnings.reduce((acc, w) => {
    if (!acc[w.timeframe]) acc[w.timeframe] = [];
    acc[w.timeframe].push(w);
    return acc;
  }, {} as Record<string, EarlyWarningEvent[]>);

  const timeframes: Array<keyof typeof timeframeConfig> = ['today', 'next-2-days', 'next-7-days', 'sprint-end'];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <Clock className="w-4 h-4 text-[#0d9488]" />
          Early Warning Timeline
        </h2>
        <span className="text-[10px] font-semibold text-[#9ca3af]">{warnings.length} event{warnings.length !== 1 ? 's' : ''}</span>
      </div>

      {warnings.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No upcoming warnings detected</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timeframes.map(tf => {
            const items = grouped[tf];
            if (!items || items.length === 0) return null;
            const cfg = timeframeConfig[tf];
            const Icon = cfg.icon;
            return (
              <div key={tf}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-[10px] text-[#9ca3af]">{items.length} event{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="ml-3 pl-4 border-l-2 border-[#e2e5ea] space-y-2">
                  {items.map(warning => (
                    <div
                      key={warning.id}
                      className="flex items-start gap-2.5 py-1.5 cursor-pointer hover:bg-[#f8fafc] rounded-lg px-2 -ml-2 transition-colors"
                      onClick={() => onNavigate?.(warning.relatedEntityType, warning.relatedEntityId)}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: severityDot[warning.severity] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-[#1a1d23] leading-snug">{warning.title}</div>
                        <div className="text-[10px] text-[#9ca3af] mt-0.5 leading-relaxed">{warning.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
