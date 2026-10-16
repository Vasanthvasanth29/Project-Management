import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HealthFactor } from './healthCalculations';

const statusColors = {
  healthy: { text: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
  'at-risk': { text: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  critical: { text: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
};

interface HealthFactorCardProps {
  factor: HealthFactor;
}

export const HealthFactorCard: React.FC<HealthFactorCardProps> = ({ factor }) => {
  const colors = statusColors[factor.status];
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (factor.score / 100) * circumference;

  return (
    <div className="card p-4 hover:border-[#e2e5ea] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs font-bold text-[#1a1d23] uppercase tracking-wider">{factor.label}</h3>
        <div className="flex items-center gap-1">
          {factor.trend > 0 && <TrendingUp className="w-3 h-3 text-[#059669]" />}
          {factor.trend < 0 && <TrendingDown className="w-3 h-3 text-[#dc2626]" />}
          {factor.trend === 0 && <Minus className="w-3 h-3 text-[#9ca3af]" />}
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#f1f5f9" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke={colors.text}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold" style={{ color: colors.text }}>{factor.score}</span>
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
          style={{ color: colors.text, backgroundColor: colors.bg }}
        >
          {factor.status === 'healthy' ? 'Healthy' : factor.status === 'at-risk' ? 'At Risk' : 'Critical'}
        </span>
      </div>
      <p className="text-[11px] text-[#6b7280] leading-relaxed">{factor.explanation}</p>
    </div>
  );
};
