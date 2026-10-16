import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface IssueSectionProps {
  title: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: 'default' | 'brand' | 'accent';
}

/**
 * Collapsible card used by every issue detail panel so Initiative / Feature /
 * Epic pages share one consistent shell.
 */
export const IssueSection: React.FC<IssueSectionProps> = ({
  title,
  icon,
  meta,
  action,
  defaultOpen = true,
  collapsible = true,
  children,
  className = '',
  bodyClassName = '',
  accent = 'default',
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const accentText =
    accent === 'brand' ? 'text-[#0d9488]' : accent === 'accent' ? 'text-[#d97706]' : 'text-[#1a1d23]';

  return (
    <section className={`bg-white rounded-2xl border border-[#e2e5ea] overflow-hidden shadow-fe-xs ${className}`}>
      <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e5ea] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => collapsible && setOpen(!open)}
          className={`flex items-center gap-2 text-left min-w-0 ${collapsible ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
        >
          {collapsible &&
            (open ? (
              <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
            ))}
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h3 className={`text-xs font-bold uppercase tracking-wider font-display truncate ${accentText}`}>
            {title}
          </h3>
          {meta && <span className="flex-shrink-0">{meta}</span>}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
          {collapsible && (
            <span className="text-[11px] text-slate-400 hover:text-slate-600 font-medium hidden sm:inline">
              {open ? 'Collapse' : 'Expand'}
            </span>
          )}
        </div>
      </div>

      {open && <div className={`p-4 ${bodyClassName}`}>{children}</div>}
    </section>
  );
};
