import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#f0fdfa] flex items-center justify-center mb-5 border border-[#ccfbf1]">
          <Icon className="w-8 h-8 text-[#0d9488]/40" />
        </div>
      )}
      <h3 className="text-lg font-bold text-[#1a1d23] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#9ca3af] max-w-sm leading-relaxed mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button className="btn-primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button className="btn-secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
