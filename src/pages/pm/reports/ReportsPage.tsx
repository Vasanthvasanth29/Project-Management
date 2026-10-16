import React, { useState } from 'react';
import {
  BarChart3, TrendingDown, TrendingUp, FileText, Clock, Users,
  GitBranch, Shield, Package, ArrowLeft, ChevronRight
} from 'lucide-react';
import { SprintReport } from './SprintReport';
import { BurndownChart } from './BurndownChart';
import { BurnupChart } from './BurnupChart';
import { VelocityReport } from './VelocityReport';
import { CumulativeFlowDiagram } from './CumulativeFlowDiagram';
import { CycleTimeReport } from './CycleTimeReport';
import { LeadTimeReport } from './LeadTimeReport';
import { WorkloadReport } from './WorkloadReport';
import { SprintHealthReport } from './SprintHealthReport';
import { VersionReport } from './VersionReport';
import {
  BurndownPreview, BurnupPreview, SprintReportPreview, VelocityPreview, CfdPreview, VersionPreview
} from './ReportPreviews';
import { useAppStore } from '../../../store/appStore';

interface ReportsPageProps {
  projectId: string;
  initialSprintId?: string;
  initialView?: string;
}

type ReportView =
  | 'sprint-report' | 'burndown' | 'burnup' | 'velocity' | 'cfd' | 'version'
  | 'cycle-time' | 'lead-time' | 'workload' | 'sprint-health';

// Views measured inside one iteration — these honour the iteration switcher.
const SPRINT_SCOPED_VIEWS = new Set<ReportView>([
  'sprint-report', 'burndown', 'burnup', 'sprint-health', 'version',
]);

interface AgileCard {
  id: ReportView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  preview: React.ComponentType;
}

// The six primary Jira agile reports, in the required grid order.
const AGILE_CARDS: AgileCard[] = [
  {
    id: 'burndown',
    label: 'Burndown Chart',
    icon: TrendingDown,
    description:
      'Track the total work remaining and project the likelihood of achieving the iteration goal. This helps your team manage its progress and respond accordingly.',
    preview: BurndownPreview,
  },
  {
    id: 'burnup',
    label: 'Burnup Chart',
    icon: TrendingUp,
    description:
      'Track the total scope independently from the total work done. This helps your team manage its progress and better understand the effect of scope change.',
    preview: BurnupPreview,
  },
  {
    id: 'sprint-report',
    label: 'Iteration Report',
    icon: FileText,
    description:
      'Understand the work completed or pushed back to the work queue in each iteration. This helps you determine if your team is overcommitting or if there is excessive scope creep.',
    preview: SprintReportPreview,
  },
  {
    id: 'velocity',
    label: 'Velocity Chart',
    icon: BarChart3,
    description:
      "Track the amount of work completed from iteration to iteration to determine your team's velocity and estimate the work your team can realistically achieve in future iterations.",
    preview: VelocityPreview,
  },
  {
    id: 'cfd',
    label: 'Cumulative Flow Diagram',
    icon: GitBranch,
    description:
      'Shows the statuses of work items over time. This helps you identify potential bottlenecks that need to be investigated.',
    preview: CfdPreview,
  },
  {
    id: 'version',
    label: 'Version Report',
    icon: Package,
    description:
      'Track the projected release date for a version. This helps you monitor whether the version will release on time, so you can take action if work is falling behind.',
    preview: VersionPreview,
  },
];

// Secondary reports — kept reachable as link-style items below the grid.
const SECONDARY_REPORTS: { id: ReportView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'sprint-health', label: 'Health Dashboard', icon: Shield },
  { id: 'cycle-time', label: 'Cycle Time', icon: Clock },
  { id: 'lead-time', label: 'Lead Time', icon: Clock },
  { id: 'workload', label: 'Workload Distribution', icon: Users },
];

const VIEW_TITLE: Record<ReportView, string> = {
  'sprint-report': 'Iteration Report',
  burndown: 'Burndown Chart',
  burnup: 'Burnup Chart',
  velocity: 'Velocity Chart',
  cfd: 'Cumulative Flow Diagram',
  version: 'Version Report',
  'cycle-time': 'Cycle Time',
  'lead-time': 'Lead Time',
  workload: 'Workload Distribution',
  'sprint-health': 'Health Dashboard',
};

export const ReportsPage: React.FC<ReportsPageProps> = ({ projectId, initialSprintId, initialView }) => {
  const { sprints } = useAppStore();
  const projectSprints = sprints
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const [activeView, setActiveView] = useState<ReportView | null>(
    (initialView as ReportView) || null
  );
  const [selectedSprintId, setSelectedSprintId] = useState<string>(
    initialSprintId || projectSprints[0]?.id || ''
  );

  const card = AGILE_CARDS.find((c) => c.id === activeView);

  /* ------------------------- Agile landing page ------------------------- */
  if (!activeView) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div>
          <h3 className="text-sm font-bold text-[#1a1d23]">Agile</h3>
        </div>

        {/* 3-column grid of exactly the six primary reports */}
        <div className="grid grid-cols-3 gap-4">
          {AGILE_CARDS.map((report) => {
            const Preview = report.preview;
            const ReportIcon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setActiveView(report.id)}
                className="group text-left bg-white border border-[#e4e7ec] rounded-xl p-3.5 transition-all hover:border-[#2563eb]/50 hover:shadow-[0_2px_8px_rgba(37,99,235,0.10)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              >
                {/* Preview / thumbnail */}
                <div className="h-28 rounded-lg border border-[#f1f3f4] bg-[#fbfcfd] overflow-hidden mb-3">
                  <Preview />
                </div>
                {/* Link-style report name */}
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] group-hover:underline">
                  <ReportIcon className="w-3.5 h-3.5" />
                  {report.label}
                </span>
                {/* Short explanatory description */}
                <p className="mt-1.5 text-[11px] leading-[1.55] text-[#6b7280]">
                  {report.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Secondary links to the other report categories */}
        <div className="border-t border-[#f1f3f4] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] mb-2">
            More reports
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {SECONDARY_REPORTS.map((report) => {
              const ReportIcon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveView(report.id)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563eb] hover:underline"
                >
                  <ReportIcon className="w-3.5 h-3.5 text-[#9ca3af]" />
                  {report.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------- Report views --------------------------- */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header: back-nav + report title + iteration selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setActiveView(null)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#6b7280] hover:bg-[#f1f3f4] hover:text-[#1a1d23] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Agile
          </button>
          <span className="text-[#d1d5db]">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
          <h3 className="text-sm font-bold text-[#1a1d23] truncate">
            {card?.label || VIEW_TITLE[activeView]}
          </h3>
        </div>
        {/* The Iteration Report carries its own top-right iteration selector. */}
        {SPRINT_SCOPED_VIEWS.has(activeView) && activeView !== 'sprint-report' && (
          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="">Select Iteration</option>
            {projectSprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Report Content */}
      {activeView === 'sprint-report' && selectedSprintId && (
        <SprintReport
          projectId={projectId}
          sprintId={selectedSprintId}
          sprintOptions={projectSprints.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
          onSprintChange={setSelectedSprintId}
        />
      )}
      {activeView === 'burndown' && selectedSprintId && (
        <BurndownChart projectId={projectId} sprintId={selectedSprintId} />
      )}
      {activeView === 'burnup' && selectedSprintId && (
        <BurnupChart projectId={projectId} sprintId={selectedSprintId} />
      )}
      {activeView === 'velocity' && (
        <VelocityReport projectId={projectId} />
      )}
      {activeView === 'cfd' && (
        <CumulativeFlowDiagram projectId={projectId} />
      )}
      {activeView === 'cycle-time' && (
        <CycleTimeReport projectId={projectId} />
      )}
      {activeView === 'lead-time' && (
        <LeadTimeReport projectId={projectId} />
      )}
      {activeView === 'workload' && (
        <WorkloadReport projectId={projectId} />
      )}
      {activeView === 'sprint-health' && selectedSprintId && (
        <SprintHealthReport projectId={projectId} sprintId={selectedSprintId} />
      )}
      {activeView === 'version' && (
        <VersionReport projectId={projectId} sprintId={selectedSprintId || undefined} />
      )}

      {SPRINT_SCOPED_VIEWS.has(activeView) && !selectedSprintId && projectSprints.length === 0 && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0d9488]/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-[#0d9488]" />
          </div>
          <h3 className="text-sm font-bold text-[#1a1d23]">No Iterations Yet</h3>
          <p className="text-xs text-[#9ca3af] mt-1">Create an iteration to view insights and health metrics.</p>
        </div>
      )}
    </div>
  );
};
