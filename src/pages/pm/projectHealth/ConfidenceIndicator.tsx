import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ConfidenceInfo } from './healthCalculations';

interface ConfidenceIndicatorProps {
  confidence: ConfidenceInfo;
  compact?: boolean;
}

const levelConfig = {
  high: { color: '#059669', bg: '#d1fae5', label: 'High Confidence' },
  medium: { color: '#d97706', bg: '#fef3c7', label: 'Medium Confidence' },
  low: { color: '#dc2626', bg: '#fee2e2', label: 'Low Confidence' },
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({ confidence, compact }) => {
  const cfg = levelConfig[confidence.level];

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}
      >
        <ShieldCheck className="w-2.5 h-2.5" />
        {cfg.label}
      </span>
    );
  }

  return (
    <div
      className="flex items-start gap-2.5 p-3 rounded-xl border"
      style={{ borderColor: `${cfg.color}30`, backgroundColor: `${cfg.bg}40` }}
    >
      <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
      <div>
        <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
        <p className="text-[10px] text-[#6b7280] mt-0.5 leading-relaxed">{confidence.reason}</p>
      </div>
    </div>
  );
};
