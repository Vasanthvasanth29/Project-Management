import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface HealthTrendProps {
  scores: number[];
}

export const HealthTrend: React.FC<HealthTrendProps> = ({ scores }) => {
  if (scores.length < 2) return null;

  const first = scores[0];
  const last = scores[scores.length - 1];
  const diff = last - first;
  const trend = diff > 2 ? 'improving' : diff < -2 ? 'declining' : 'stable';

  const trendConfig = {
    improving: { label: 'Improving', color: '#059669', bg: '#d1fae5', icon: TrendingUp },
    stable: { label: 'Stable', color: '#6b7280', bg: '#f3f4f6', icon: Minus },
    declining: { label: 'Declining', color: '#dc2626', bg: '#fee2e2', icon: TrendingDown },
  };

  const cfg = trendConfig[trend];
  const TrendIcon = cfg.icon;

  const max = Math.max(...scores, 100);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <BarChart3 className="w-4 h-4 text-[#0d9488]" />
          Health Trend
        </h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
          style={{ color: cfg.color, backgroundColor: cfg.bg }}
        >
          <TrendIcon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-end gap-2 h-24 mb-3">
        {scores.map((score, idx) => {
          const heightPct = ((score - min) / range) * 80 + 20;
          const isLast = idx === scores.length - 1;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold text-[#4b5563]">{score}</span>
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${heightPct}%`,
                  background: isLast
                    ? 'linear-gradient(180deg, #0d9488, #06b6d4)'
                    : '#e2e8f0',
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#9ca3af]">
        <span>Est. Previous: {first}</span>
        <span className="flex items-center gap-1">
          {diff > 0 ? '+' : ''}{diff} points
          {diff > 0 ? ' (up)' : diff < 0 ? ' (down)' : ' (unchanged)'}
        </span>
        <span>Current: {last}</span>
      </div>
      <p className="text-[9px] text-[#9ca3af] italic mt-2 text-center">
        Trend is estimated from factor variances. No historical data is stored.
      </p>
    </div>
  );
};
