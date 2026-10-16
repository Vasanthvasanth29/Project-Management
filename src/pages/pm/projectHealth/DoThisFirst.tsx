import React from 'react';
import { Zap, ArrowRight, AlertOctagon, AlertTriangle } from 'lucide-react';
import type { DoThisFirstItem } from './healthCalculations';

interface DoThisFirstProps {
  item: DoThisFirstItem | null;
  onAction?: (type: string, targetId?: string) => void;
}

export const DoThisFirst: React.FC<DoThisFirstProps> = ({ item, onAction }) => {
  if (!item) return null;

  const isCritical = item.severity === 'critical';

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 lg:p-6 border-2"
      style={{
        borderColor: isCritical ? '#dc2626' : '#d97706',
        background: isCritical
          ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 50%, #fef2f2 100%)'
          : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isCritical ? '#fee2e2' : '#fef3c7' }}
        >
          {isCritical ? (
            <AlertOctagon className="w-5 h-5 text-[#dc2626]" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[#d97706]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5" style={{ color: isCritical ? '#dc2626' : '#d97706' }} />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: isCritical ? '#dc2626' : '#d97706' }}
            >
              Do This First
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#1a1d23] mb-2 font-display">{item.title}</h3>
          <p className="text-[11px] text-[#6b7280] leading-relaxed mb-3">{item.reason}</p>
          <button
            onClick={() => onAction?.(item.actionType, item.actionTargetId)}
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            style={{
              color: isCritical ? '#fff' : '#92400e',
              backgroundColor: isCritical ? '#dc2626' : '#f59e0b',
            }}
          >
            {item.actionLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
