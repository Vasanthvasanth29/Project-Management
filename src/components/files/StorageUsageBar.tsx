import React from 'react';
import { HardDrive, AlertTriangle, Info } from 'lucide-react';
import { formatFileSize } from '../../utils/fileConfig';
import { getStorageUsageWarningLevel } from '../../utils/fileConfig';
import type { StorageUsageData } from '../../types';

interface StorageUsageBarProps {
  usage: StorageUsageData;
  showLabels?: boolean;
  showDemoBadge?: boolean;
}

export const StorageUsageBar: React.FC<StorageUsageBarProps> = ({ usage, showLabels = true, showDemoBadge = true }) => {
  const userPct = Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100));
  const projectPct = Math.min(100, Math.round((usage.projectUsedBytes / usage.projectQuotaBytes) * 100));
  const userLevel = getStorageUsageWarningLevel(usage.usedBytes, usage.quotaBytes);
  const projectLevel = getStorageUsageWarningLevel(usage.projectUsedBytes, usage.projectQuotaBytes);

  const getBarColor = (level: 'ok' | 'warning' | 'exceeded') => {
    if (level === 'exceeded') return 'bg-red-500';
    if (level === 'warning') return 'bg-amber-500';
    return 'bg-[#0d9488]';
  };

  const getTextColor = (level: 'ok' | 'warning' | 'exceeded') => {
    if (level === 'exceeded') return 'text-red-600';
    if (level === 'warning') return 'text-amber-600';
    return 'text-slate-600';
  };

  return (
    <div className="space-y-3">
      {showDemoBadge && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200">
          <Info className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] font-medium text-amber-700">Demo data — storage values are simulated</span>
        </div>
      )}

      {/* User storage */}
      <div>
        {showLabels && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> Your Storage
            </span>
            <span className={`text-[11px] font-semibold ${getTextColor(userLevel)}`}>
              {formatFileSize(usage.usedBytes)} / {formatFileSize(usage.quotaBytes)}
            </span>
          </div>
        )}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(userLevel)}`}
            style={{ width: `${userPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">{userPct}% used</span>
          {userLevel === 'warning' && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Nearing limit
            </span>
          )}
          {userLevel === 'exceeded' && (
            <span className="text-[10px] text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Quota exceeded
            </span>
          )}
        </div>
      </div>

      {/* Project storage */}
      <div>
        {showLabels && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Project Storage
            </span>
            <span className={`text-[11px] font-semibold ${getTextColor(projectLevel)}`}>
              {formatFileSize(usage.projectUsedBytes)} / {formatFileSize(usage.projectQuotaBytes)}
            </span>
          </div>
        )}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(projectLevel)}`}
            style={{ width: `${projectPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">{projectPct}% used</span>
          {projectLevel === 'warning' && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Nearing limit
            </span>
          )}
          {projectLevel === 'exceeded' && (
            <span className="text-[10px] text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Quota exceeded
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
