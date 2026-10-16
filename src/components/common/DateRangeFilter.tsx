import React from 'react';
import { Calendar, X, Filter } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns';

interface DateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onClear: () => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
  label = 'Due Date Range',
  className = '',
  compact = false,
}) => {
  const isActive = Boolean(fromDate || toDate);

  const applyToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    onFromDateChange(today);
    onToDateChange(today);
  };

  const applyThisWeek = () => {
    const now = new Date();
    const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    onFromDateChange(start);
    onToDateChange(end);
  };

  const applyThisMonth = () => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');
    onFromDateChange(start);
    onToDateChange(end);
  };

  const applyNext30Days = () => {
    const now = new Date();
    const start = format(now, 'yyyy-MM-dd');
    const end = format(addDays(now, 30), 'yyyy-MM-dd');
    onFromDateChange(start);
    onToDateChange(end);
  };

  const applyYear = (year: number) => {
    onFromDateChange(`${year}-01-01`);
    onToDateChange(`${year}-12-31`);
  };

  if (compact) {
    return (
      <div className={`flex items-center flex-wrap gap-2 text-xs ${className}`}>
        <div className="flex items-center gap-1 text-[#747775] font-medium">
          <Calendar className="w-3.5 h-3.5 text-[#1a73e8]" />
          <span>{label}:</span>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#c4c7c5] rounded-xl px-2 py-1 shadow-2xs focus-within:border-[#1a73e8]">
          <span className="text-[11px] text-[#747775] font-semibold">From</span>
          <input
            type="date"
            min="2020-01-01"
            max="2035-12-31"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="bg-transparent text-xs text-[#1f1f1f] focus:outline-none cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#c4c7c5] rounded-xl px-2 py-1 shadow-2xs focus-within:border-[#1a73e8]">
          <span className="text-[11px] text-[#747775] font-semibold">To</span>
          <input
            type="date"
            min="2020-01-01"
            max="2035-12-31"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="bg-transparent text-xs text-[#1f1f1f] focus:outline-none cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => applyYear(2024)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#444746] transition-colors"
          >
            2024
          </button>
          <button
            type="button"
            onClick={() => applyYear(2025)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#444746] transition-colors"
          >
            2025
          </button>
          <button
            type="button"
            onClick={applyToday}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#444746] transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={applyThisMonth}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#444746] transition-colors"
          >
            This Month
          </button>
          {isActive && (
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#fce8e6] text-[#c5221f] hover:bg-[#fad2cf] transition-colors flex items-center gap-1 ml-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl p-3.5 border border-[#e0e2ec] shadow-2xs space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#1a73e8]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#1f1f1f]">{label}</div>
            <div className="text-[10px] text-[#747775]">Filter items by from-date to to-date</div>
          </div>
        </div>

        {isActive && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#0b57d0] text-[10px] font-bold">
              <Filter className="w-3 h-3" /> Filter Active
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-[#c5221f] font-bold hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear Filter
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#444746]">From Date</label>
          <input
            type="date"
            min="2020-01-01"
            max="2035-12-31"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="w-full bg-[#f8fafd] border border-[#c4c7c5] rounded-xl px-3 py-1.5 text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#444746]">To Date</label>
          <input
            type="date"
            min="2020-01-01"
            max="2035-12-31"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="w-full bg-[#f8fafd] border border-[#c4c7c5] rounded-xl px-3 py-1.5 text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1 border-t border-[#f1f3f4] flex-wrap">
        <span className="text-[10px] font-bold text-[#747775] uppercase tracking-wider mr-1">Presets:</span>
        <button
          type="button"
          onClick={() => applyYear(2024)}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          2024
        </button>
        <button
          type="button"
          onClick={() => applyYear(2025)}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          2025
        </button>
        <button
          type="button"
          onClick={() => applyYear(2026)}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          2026
        </button>
        <button
          type="button"
          onClick={applyToday}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={applyThisWeek}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          This Week
        </button>
        <button
          type="button"
          onClick={applyThisMonth}
          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#f0f4f9] hover:bg-[#e0e8f6] text-[#1f1f1f] transition-colors"
        >
          This Month
        </button>
      </div>
    </div>
  );
};
