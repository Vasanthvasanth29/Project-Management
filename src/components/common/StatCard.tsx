import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: number;
  trendLabel?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = '#0d9488',
  iconBg = '#ccfbf1',
  trend,
  trendLabel,
  badge,
  badgeColor = 'badge-gray',
  onClick,
}) => {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="w-3.5 h-3.5" />;
    if (trend < 0) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return 'text-[#4b5563]';
    if (trend > 0) return 'text-[#059669] bg-[#d1fae5] px-2 py-0.5 rounded-lg font-semibold';
    if (trend < 0) return 'text-[#dc2626] bg-[#fee2e2] px-2 py-0.5 rounded-lg font-semibold';
    return 'text-[#4b5563] bg-[#f1f5f9] px-2 py-0.5 rounded-lg font-semibold';
  };

  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">{title}</span>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
      </div>
      
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl lg:text-3xl font-bold text-[#1a1d23] tracking-tight">{value}</div>
        {badge && <span className={badgeColor}>{badge}</span>}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f1f5f9]">
          <span className={`inline-flex items-center gap-1 text-xs ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{Math.abs(trend)}%</span>
          </span>
          <span className="text-xs text-[#9ca3af] truncate">{trendLabel || 'vs previous period'}</span>
        </div>
      )}
    </div>
  );
};
