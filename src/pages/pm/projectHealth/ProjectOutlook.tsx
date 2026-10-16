import React from 'react';
import { TrendingUp, AlertTriangle, AlertOctagon, CheckCircle } from 'lucide-react';
import type { ProjectOutlook as OutlookType } from './computeProjectSignals';

interface ProjectOutlookProps {
  outlook: OutlookType;
  reason: string;
  signalCount: number;
}

const outlookConfig: Record<OutlookType, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  'on-track': {
    icon: CheckCircle,
    color: '#059669',
    bg: '#d1fae5',
    border: '#a7f3d0',
    label: 'On Track',
  },
  watch: {
    icon: AlertTriangle,
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fde68a',
    label: 'Watch',
  },
  'at-risk': {
    icon: AlertOctagon,
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fecaca',
    label: 'At Risk',
  },
};

export const ProjectOutlook: React.FC<ProjectOutlookProps> = ({ outlook, reason, signalCount }) => {
  const config = outlookConfig[outlook];
  const Icon = config.icon;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: `${config.bg}40`, borderColor: config.border }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-[#1a1d23]">Project Outlook</h3>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-[#9ca3af]">
              {signalCount} predictive signal{signalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-[#4b5563] leading-relaxed">{reason}</p>
        </div>
      </div>
    </div>
  );
};
