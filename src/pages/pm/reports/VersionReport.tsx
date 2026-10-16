import React, { useMemo } from 'react';
import { Package, CalendarDays, CheckCircle2, CircleDashed } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { formatDate } from '../../../utils/dateUtils';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import type { Release, ReleaseStatus, Task } from '../../../types';

interface VersionReportProps {
  projectId: string;
  /** When the iteration switcher has a sprint selected, only that sprint's work is counted. */
  sprintId?: string;
}

const STATUS_CHIP: Record<ReleaseStatus, string> = {
  PLANNING: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RELEASED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
};

const STATUS_LABEL: Record<ReleaseStatus, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

interface ReleaseRow {
  release: Release;
  total: number;
  done: number;
  cancelled: number;
  active: number;
  remaining: number;
  totalPoints: number;
  donePoints: number;
  completionPct: number;
  tasks: Task[];
}

export const VersionReport: React.FC<VersionReportProps> = ({ projectId, sprintId }) => {
  const { releases, tasks, sprints } = useAppStore();

  const selectedSprint = sprintId ? sprints.find((s) => s.id === sprintId) : undefined;

  const rows = useMemo((): ReleaseRow[] => {
    return releases
      .filter((r) => r.projectId === projectId)
      .map((release) => {
        // Release scope: its own tasks plus everything under its epics.
        const epicIds = new Set(release.epicIds);
        let members = tasks.filter(
          (t) => t.projectId === projectId && (release.taskIds.includes(t.id) || (t.parentId && epicIds.has(t.parentId)))
        );
        if (sprintId) members = members.filter((t) => t.sprintId === sprintId);

        const isCancelled = (t: Task) => isCancelledWorkItem(t);
        const done = members.filter((t) => t.status === 'DONE' && !isCancelled(t));
        const cancelled = members.filter(isCancelled);
        const active = members.filter((t) => t.status !== 'DONE');
        const totalPoints = members.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const donePoints = done.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const completionPct =
          members.length > 0
            ? Math.round((done.length / members.length) * 100)
            : release.progress;

        return {
          release,
          total: members.length,
          done: done.length,
          cancelled: cancelled.length,
          active: active.length,
          remaining: members.length - done.length - cancelled.length,
          totalPoints,
          donePoints,
          completionPct,
          tasks: members,
        };
      })
      .sort((a, b) => new Date(a.release.targetDate).getTime() - new Date(b.release.targetDate).getTime());
  }, [releases, tasks, projectId, sprintId]);

  const summary = useMemo(() => {
    const inProgress = rows.filter((r) => r.release.status === 'IN_PROGRESS').length;
    const released = rows.filter((r) => r.release.status === 'RELEASED').length;
    const planning = rows.filter((r) => r.release.status === 'PLANNING').length;
    const openIssues = rows.reduce((sum, r) => sum + r.active, 0);
    return { count: rows.length, inProgress, released, planning, openIssues };
  }, [rows]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
                <Package className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <h2 className="text-sm font-bold text-[#1f1f1f] font-display">Version Report</h2>
            </div>
            <p className="text-xs text-[#747775]">
              Release scope, delivery progress and open work
              {selectedSprint ? ` — filtered to ${selectedSprint.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-[#1f1f1f]">{summary.count}</div>
              <div className="text-[10px] text-[#747775]">Versions</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[#1a73e8]">{summary.inProgress}</div>
              <div className="text-[10px] text-[#747775]">In Progress</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-600">{summary.released}</div>
              <div className="text-[10px] text-[#747775]">Released</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-amber-600">{summary.openIssues}</div>
              <div className="text-[10px] text-[#747775]">Open Work Items</div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-[#747775]">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No versions defined for this project yet.</p>
            <p className="text-[10px] mt-1">Create a release to track its delivery progress here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(({ release, total, done, cancelled, active, totalPoints, donePoints, completionPct }) => (
              <div key={release.id} className="rounded-xl border border-[#e2e5ea] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#1f1f1f]">{release.name}</span>
                      <span className="font-mono text-[11px] font-semibold text-[#1a73e8]">v{release.version}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CHIP[release.status]}`}>
                        {STATUS_LABEL[release.status]}
                      </span>
                    </div>
                    {release.description && (
                      <p className="text-xs text-[#747775] mt-1">{release.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#747775]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" /> {formatDate(release.startDate)} → {formatDate(release.targetDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {done}
                        {total > 0 ? ` / ${total}` : ''} done
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CircleDashed className="w-3.5 h-3.5 text-amber-600" /> {active} open
                      </span>
                      {cancelled > 0 && <span className="text-slate-500">{cancelled} cancelled</span>}
                      {totalPoints > 0 && <span>{donePoints}/{totalPoints} pts</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-[#1f1f1f]">{completionPct}%</div>
                    <div className="text-[10px] text-[#747775]">Complete</div>
                  </div>
                </div>

                {/* Segmented delivery bar: done / in flight / remaining / cancelled */}
                <div className="mt-3 h-2.5 rounded-full bg-[#f1f3f4] overflow-hidden flex">
                  {total > 0 ? (
                    <>
                      <div className="bg-emerald-500 h-full" style={{ width: `${(done / total) * 100}%` }} />
                      <div className="bg-blue-400 h-full" style={{ width: `${(active / total) * 100}%` }} />
                      <div className="bg-amber-300 h-full" style={{ width: `${((total - done - active - cancelled) / total) * 100}%` }} />
                      <div className="bg-slate-400 h-full" style={{ width: `${(cancelled / total) * 100}%` }} />
                    </>
                  ) : (
                    <div className="bg-slate-300 h-full" style={{ width: `${Math.min(100, release.progress)}%` }} />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-[#747775]">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Done</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> In progress</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" /> To do</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Cancelled</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
