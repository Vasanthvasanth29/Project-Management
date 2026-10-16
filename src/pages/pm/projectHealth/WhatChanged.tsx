import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, GitCompare } from 'lucide-react';
import type { WhatChangedItem } from './healthCalculations';

interface WhatChangedProps {
  changes: WhatChangedItem[];
}

const directionConfig = {
  improved: { icon: ArrowUpRight, color: '#059669', bg: '#d1fae5' },
  declined: { icon: ArrowDownRight, color: '#dc2626', bg: '#fee2e2' },
  unchanged: { icon: Minus, color: '#6b7280', bg: '#f3f4f6' },
};

export const WhatChanged: React.FC<WhatChangedProps> = ({ changes }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <GitCompare className="w-4 h-4 text-[#0d9488]" />
          What Changed
        </h2>
        <span className="text-[10px] font-semibold text-[#9ca3af]">Estimated changes</span>
      </div>

      {changes.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No changes detected</p>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {changes.map(change => {
            const cfg = directionConfig[change.direction];
            const Icon = cfg.icon;
            return (
              <div
                key={change.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-[#1a1d23]">{change.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0">
                  <span className="text-[#9ca3af]">{change.previousValue}</span>
                  <span className="text-[#d1d5db]">&rarr;</span>
                  <span className="font-bold" style={{ color: cfg.color }}>{change.currentValue}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-[#9ca3af] italic mt-3 text-center">
          Previous values are estimated from current factor trends. No historical data is stored.
        </p>
        </>
      )}
    </div>
  );
};
