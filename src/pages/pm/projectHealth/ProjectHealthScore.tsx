import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';
import type { HealthStatus, HealthFactor } from './healthCalculations';

interface ProjectHealthScoreProps {
  score: number;
  status: HealthStatus;
  trend: number;
  mainReasons: HealthFactor[];
  positiveSignals: HealthFactor[];
}

const statusConfig: Record<HealthStatus, { label: string; color: string; ringColor: string; bg: string }> = {
  healthy: { label: 'Healthy', color: '#059669', ringColor: '#10b981', bg: '#d1fae5' },
  'at-risk': { label: 'At Risk', color: '#d97706', ringColor: '#f59e0b', bg: '#fef3c7' },
  critical: { label: 'Critical', color: '#dc2626', ringColor: '#ef4444', bg: '#fee2e2' },
};

export const ProjectHealthScore: React.FC<ProjectHealthScoreProps> = ({
  score, status, trend, mainReasons, positiveSignals,
}) => {
  const config = statusConfig[status];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center">
      <div className="relative w-32 h-32 mb-3">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={config.ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: config.color }}>{score}</span>
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      <span
        className="text-sm font-bold px-3 py-1 rounded-lg mb-3"
        style={{ color: config.color, backgroundColor: config.bg }}
      >
        {config.label}
      </span>
      <div className="flex items-center gap-1.5 mb-4">
        {trend > 0 && <TrendingUp className="w-3.5 h-3.5 text-[#059669]" />}
        {trend < 0 && <TrendingDown className="w-3.5 h-3.5 text-[#dc2626]" />}
        {trend === 0 && <Minus className="w-3.5 h-3.5 text-[#9ca3af]" />}
        <span className={`text-xs font-semibold ${trend > 0 ? 'text-[#059669]' : trend < 0 ? 'text-[#dc2626]' : 'text-[#9ca3af]'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>

      {/* Score Explanation */}
      <div className="w-full text-left space-y-2">
        {mainReasons.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-[#d97706]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#d97706]">Needs Attention</span>
            </div>
            {mainReasons.map(f => (
              <div key={f.id} className="flex items-center gap-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                <span className="text-[10px] text-[#4b5563]">
                  <span className="font-semibold">{f.label}:</span>{' '}
                  {f.status === 'critical' ? 'Critical' : 'At Risk'} ({f.score})
                </span>
              </div>
            ))}
          </div>
        )}
        {positiveSignals.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className="w-3 h-3 text-[#059669]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#059669]">Positive Signals</span>
            </div>
            {positiveSignals.map(f => (
              <div key={f.id} className="flex items-center gap-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                <span className="text-[10px] text-[#4b5563]">
                  <span className="font-semibold">{f.label}:</span> Healthy ({f.score})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
