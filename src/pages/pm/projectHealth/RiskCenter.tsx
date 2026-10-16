import React, { useState } from 'react';
import { ShieldAlert, Filter } from 'lucide-react';
import { RiskCard } from './RiskCard';
import type { ProjectRisk } from './healthCalculations';

interface RiskCenterProps {
  risks: ProjectRisk[];
  onAction?: (type: string, targetId?: string) => void;
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export const RiskCenter: React.FC<RiskCenterProps> = ({ risks, onAction }) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const filtered = filter === 'all'
    ? [...risks].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    : risks.filter(r => r.severity === filter).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const counts = {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
          Risk &rarr; Impact &rarr; Action
          <span className="text-[10px] font-bold text-[#9ca3af] bg-[#f1f5f9] px-2 py-0.5 rounded-lg ml-1">
            {risks.length} detected
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-[#9ca3af]" />
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#0d9488] text-white'
                  : 'text-[#6b7280] hover:bg-[#f1f5f9]'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && counts[f] > 0 && (
                <span className="ml-1">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No {filter !== 'all' ? filter : ''} risks detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(risk => (
            <RiskCard key={risk.id} risk={risk} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
};
