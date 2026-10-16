// ============================================================
// Browser-side audit export helpers (CSV / JSON download).
// Pure functions — no store access, no network.
// ============================================================

export type ExportRow = Record<string, string | number>;

const csvEscape = (value: string | number): string => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const toCSV = (rows: ExportRow[]): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  return lines.join('\n');
};

export const downloadTextFile = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const timestampSlug = (): string => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** "2026-10-08 14:05" in the browser's local time. */
export const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "8 Oct 2026, 2:05 PM" — compact display form. */
export const formatDisplayTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
