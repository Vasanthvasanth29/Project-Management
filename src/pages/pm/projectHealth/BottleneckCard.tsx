import React from 'react';
import { Layers, AlertTriangle, AlertCircle, Info, AlertOctagon } from 'lucide-react';
import type { BottleneckData } from './healthCalculations';

interface BottleneckSectionProps {
  bottlenecks: BottleneckData[];
}

const severityConfig = {
  critical: { icon: AlertOctagon, color: '#dc2626', bg: '#fee2e2' },
  high: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' },
  medium: { icon: AlertCircle, color: '#2563eb', bg: '#dbeafe' },
  low: { icon: Info, color: '#6b7280', bg: '#f3f4f6' },
};

export const BottleneckSection: React.FC<BottleneckSectionProps> = ({ bottlenecks }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <Layers className="w-4 h-4 text-[#8b5cf6]" />
          Bottlenecks
        </h2>
        <span className="text-[10px] font-semibold text-[#9ca3af]">Where work is getting stuck</span>
      </div>

      {bottlenecks.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No bottlenecks detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bottlenecks.map((bn, idx) => {
            const cfg = severityConfig[bn.severity];
            const Icon = cfg.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1a1d23]">{bn.stage}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {bn.severity}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#9ca3af] mt-0.5">
                    {bn.taskCount} task{bn.taskCount !== 1 ? 's' : ''} · {bn.percentage}% of total
                  </div>
                </div>
                <div className="w-20 flex-shrink-0">
                  <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${bn.percentage}%`, backgroundColor: cfg.color }}
                    />
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
