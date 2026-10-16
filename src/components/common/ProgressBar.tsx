import React from 'react';

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  animated?: boolean;
}

const heightClasses = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = '#0d9488',
  height = 'md',
  showLabel = false,
  className = '',
  animated = true,
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-1 bg-[#f1f5f9] rounded-full overflow-hidden ${heightClasses[height]}`}>
        <div
          className={`${heightClasses[height]} rounded-full ${animated ? 'transition-all duration-700 ease-out' : ''}`}
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-bold text-[#1a1d23] w-10 text-right">{clamped}%</span>
      )}
    </div>
  );
};
