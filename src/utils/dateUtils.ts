import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

/**
 * Returns the current date/time.
 * Centralized so it can be replaced with server time when a backend is added.
 */
export const getCurrentDate = (): Date => new Date();

export const formatDate = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d, yyyy');
  } catch {
    return '—';
  }
};

export const formatShortDate = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d');
  } catch {
    return '—';
  }
};

export const formatDateTime = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
};

/**
 * Exact date and time with year: "Oct 6, 2026, 12:35 PM".
 * Used for the issue detail "Updated" field — never relative text.
 */
export const formatFullDateTime = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d, yyyy, h:mm a');
  } catch {
    return '—';
  }
};

/**
 * Exact due date with year and time: "Oct 12, 2026, 6:00 PM", keeping the
 * Overdue indicator when the date has passed ("Overdue · Oct 12, 2026, 6:00 PM").
 * Uses the app's standard date/time format (formatFullDateTime — the same
 * one the "Updated" field uses) and always renders the actual stored
 * due-date/time value — nothing is hardcoded or rounded.
 * Never relative ("Due today", "3 days ago", ...).
 */
export const formatDueDate = (dueDate: string | undefined): string => {
  if (!dueDate) return 'No due date';
  // Non-breaking space before AM/PM so the time suffix never wraps onto a
  // line of its own; the rendered text is otherwise identical.
  const base = formatFullDateTime(dueDate).replace(/ (AM|PM)$/, '\u00A0$1');
  return isOverdue(dueDate) ? `Overdue · ${base}` : base;
};

export const formatTimeAgo = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true });
  } catch {
    return '—';
  }
};

export const formatTime = (date: string | undefined): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'h:mm a');
  } catch {
    return '—';
  }
};

export const isOverdue = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false;
  try {
    return isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate));
  } catch {
    return false;
  }
};

export const isDueToday = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false;
  try {
    return isToday(parseISO(dueDate));
  } catch {
    return false;
  }
};

export const isDueTomorrow = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false;
  try {
    return isTomorrow(parseISO(dueDate));
  } catch {
    return false;
  }
};

export const getDueDateClass = (dueDate: string | undefined): string => {
  if (!dueDate) return 'text-slate-400';
  if (isOverdue(dueDate)) return 'text-red-600 font-medium';
  if (isDueToday(dueDate)) return 'text-amber-600 font-medium';
  return 'text-slate-500';
};

export const getDueDateLabel = (dueDate: string | undefined): string => {
  if (!dueDate) return 'No due date';
  if (isOverdue(dueDate)) return `Overdue · ${formatShortDate(dueDate)}`;
  if (isDueToday(dueDate)) return 'Due today';
  if (isDueTomorrow(dueDate)) return 'Due tomorrow';
  return `Due ${formatShortDate(dueDate)}`;
};

export const isDateInRange = (
  dateStr: string | undefined,
  fromDate: string | undefined,
  toDate: string | undefined
): boolean => {
  if (!fromDate && !toDate) return true;
  if (!dateStr) return false;

  try {
    // Extract YYYY-MM-DD from dateStr if ISO or full string
    const targetDate = dateStr.slice(0, 10);
    
    if (fromDate && targetDate < fromDate) {
      return false;
    }
    if (toDate && targetDate > toDate) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

