import React from 'react';

interface IssueFieldProps {
  label: string;
  children?: React.ReactNode;
  /** Render label + value on a single line (default) or stacked on small screens */
  stacked?: boolean;
}

/**
 * Single label/value row used inside `IssueDetailsSection`.
 * Falls back to an em dash when no value is provided.
 */
export const IssueField: React.FC<IssueFieldProps> = ({ label, children, stacked = false }) => {
  const hasValue = children !== undefined && children !== null && children !== false;

  return (
    <div className={`flex gap-2 min-w-0 ${stacked ? 'flex-col gap-0.5' : 'items-start'}`}>
      <span className="w-36 sm:w-40 flex-shrink-0 text-[11px] text-slate-500 font-medium leading-5">
        {label}
      </span>
      <span className="text-xs text-slate-800 font-semibold leading-5 min-w-0 break-words flex-1">
        {hasValue ? children : <span className="text-slate-300 font-normal">&#8212;</span>}
      </span>
    </div>
  );
};

interface IssueChipsProps {
  values?: string[];
  mono?: boolean;
}

/** Compact chip list for multi-value fields (labels, versions, components, CIs). */
export const IssueChips: React.FC<IssueChipsProps> = ({ values, mono = false }) => {
  if (!values || values.length === 0) return <>&#8212;</>;

  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className={`inline-flex items-center px-2 py-0.5 rounded-md bg-[#f1f5f9] border border-[#e2e8f0] text-[11px] font-semibold text-slate-600 ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </span>
      ))}
    </span>
  );
};
