import React, { useState, useMemo } from 'react';
import { Download, FileText, FileSpreadsheet, Clock, User, Filter, Calendar, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import {
  generateSprintReportPDF,
  generateProjectReportPDF,
  generateReleaseReportPDF,
  generateRoadmapSummaryPDF,
  downloadBlob,
} from '../../utils/pdfExport';
import { EmptyState } from '../../components/common/EmptyState';
import { displayStatusLabel, isCancelledWorkItem } from '../../utils/roleUtils';

interface ExportPanelProps {
  projectId: string;
}

interface ExportRecord {
  id: string;
  type: string;
  format: string;
  filename: string;
  generatedBy: string;
  timestamp: string;
  blob?: Blob;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ projectId }) => {
  const { tasks, sprints, releases, projects, users } = useAppStore();
  const { currentUser } = useAuthStore();
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const projectSprints = sprints.filter((s) => s.projectId === projectId);
  const projectReleases = releases.filter((r) => r.projectId === projectId);
  const projectEpics = projectTasks.filter((t) => t.type === 'EPIC');

  const filteredTasks = useMemo(() => {
    let result = projectTasks;
    if (dateFrom) result = result.filter((t) => t.createdAt >= dateFrom);
    if (dateTo) result = result.filter((t) => t.createdAt <= dateTo);
    return result;
  }, [projectTasks, dateFrom, dateTo]);

  const addExportRecord = (type: string, format: string, filename: string, blob?: Blob) => {
    const record: ExportRecord = {
      id: `exp-${Date.now()}`,
      type,
      format,
      filename,
      generatedBy: currentUser?.name || 'Unknown',
      timestamp: new Date().toISOString(),
      blob,
    };
    setExportHistory((prev) => [record, ...prev]);
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, filename);
    addExportRecord('CSV Export', 'CSV', filename, blob);
  };

  const downloadXLSX = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    downloadBlob(blob, filename.replace('.xlsx', '.xls'));
    addExportRecord('XLSX Export', 'XLSX', filename, blob);
  };

  const handleExportTasksCSV = () => {
    const headers = ['Title', 'Status', 'Priority', 'Type', 'Story Points', 'Assignee', 'Sprint', 'Due Date'];
    const rows = filteredTasks.map((t) => [
      t.title, displayStatusLabel(t), t.priority, t.type,
      t.storyPoints?.toString() || '0',
      t.assigneeId || 'Unassigned',
      t.sprintId || 'Backlog',
      t.dueDate || ''
    ]);
    downloadCSV(headers, rows, `tasks-${projectId}.csv`);
    toast.success('Tasks exported as CSV');
  };

  const handleExportTasksXLSX = () => {
    const headers = ['Title', 'Status', 'Priority', 'Type', 'Story Points', 'Assignee', 'Sprint', 'Due Date'];
    const rows = filteredTasks.map((t) => [
      t.title, displayStatusLabel(t), t.priority, t.type,
      t.storyPoints?.toString() || '0',
      t.assigneeId || 'Unassigned',
      t.sprintId || 'Backlog',
      t.dueDate || ''
    ]);
    downloadXLSX(headers, rows, `tasks-${projectId}.xlsx`);
    toast.success('Tasks exported as XLSX');
  };

  const handleExportSprintCSV = () => {
    const headers = ['Sprint', 'Status', 'Start Date', 'End Date', 'Tasks', 'Story Points'];
    const rows = projectSprints.map((s) => {
      const sprintTasks = projectTasks.filter((t) => t.sprintId === s.id);
      const points = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return [s.name, s.status, s.startDate, s.endDate, sprintTasks.length.toString(), points.toString()];
    });
    downloadCSV(headers, rows, `sprints-${projectId}.csv`);
    toast.success('Iteration report exported as CSV');
  };

  const handleExportRoadmapCSV = () => {
    const headers = ['Epic', 'Status', 'Priority', 'Start Date', 'Due Date', 'Progress', 'Story Points'];
    const rows = projectEpics.map((e) => {
      const childTasks = projectTasks.filter((t) => t.parentId === e.id);
      // Cancelled work is out of scope: it is neither completed nor remaining.
      const scopeTasks = childTasks.filter((t) => !isCancelledWorkItem(t));
      const completed = scopeTasks.filter((t) => t.status === 'DONE').length;
      const progress = scopeTasks.length > 0 ? Math.round((completed / scopeTasks.length) * 100) : 0;
      const points = childTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      return [e.title, e.status, e.priority, e.startDate || '', e.dueDate || '', `${progress}%`, String(points)];
    });
    downloadCSV(headers, rows, `roadmap-${projectId}.csv`);
    toast.success('Roadmap exported as CSV');
  };

  const handleExportReleaseCSV = () => {
    const headers = ['Release', 'Version', 'Status', 'Start Date', 'Target Date', 'Progress'];
    const rows = projectReleases.map((r) => [r.name, r.version, r.status, r.startDate, r.targetDate, `${r.progress}%`]);
    downloadCSV(headers, rows, `releases-${projectId}.csv`);
    toast.success('Releases exported as CSV');
  };

  const handleExportProjectPDF = () => {
    if (!project) return;
    const blob = generateProjectReportPDF(project, projectTasks, projectSprints, projectReleases, users);
    downloadBlob(blob, `project-report-${project.name.replace(/\s+/g, '_')}.pdf`);
    addExportRecord('Project Report', 'PDF', `project-report-${project.name.replace(/\s+/g, '_')}.pdf`, blob);
    toast.success('Project report PDF downloaded');
  };

  const handleExportSprintPDF = () => {
    if (!selectedSprintId) { toast.error('Select an iteration first'); return; }
    const sprint = projectSprints.find((s) => s.id === selectedSprintId);
    if (!sprint || !project) return;
    const blob = generateSprintReportPDF(sprint, tasks, users, project);
    downloadBlob(blob, `sprint-report-${sprint.name.replace(/\s+/g, '_')}.pdf`);
    addExportRecord('Iteration Report', 'PDF', `sprint-report-${sprint.name.replace(/\s+/g, '_')}.pdf`, blob);
    toast.success('Iteration report PDF downloaded');
  };

  const handleExportReleasePDF = () => {
    if (!selectedReleaseId) { toast.error('Select a release first'); return; }
    const release = projectReleases.find((r) => r.id === selectedReleaseId);
    if (!release || !project) return;
    const blob = generateReleaseReportPDF(release, tasks, users, project);
    downloadBlob(blob, `release-report-${release.name.replace(/\s+/g, '_')}.pdf`);
    addExportRecord('Release Report', 'PDF', `release-report-${release.name.replace(/\s+/g, '_')}.pdf`, blob);
    toast.success('Release report PDF downloaded');
  };

  const handleExportRoadmapPDF = () => {
    if (!project) return;
    const blob = generateRoadmapSummaryPDF(project, projectEpics, projectTasks, users);
    downloadBlob(blob, `roadmap-summary-${project.name.replace(/\s+/g, '_')}.pdf`);
    addExportRecord('Roadmap Summary', 'PDF', `roadmap-summary-${project.name.replace(/\s+/g, '_')}.pdf`, blob);
    toast.success('Roadmap summary PDF downloaded');
  };

  const handleRedownload = (record: ExportRecord) => {
    if (record.blob) {
      downloadBlob(record.blob, record.filename);
      toast.success(`Re-downloaded ${record.filename}`);
    } else {
      toast.error('Export data no longer available for re-download');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-500" /> Export Data
        </h3>

        {/* Date Range Filter */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Date Range:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-xs py-1" />
            </div>
            <span className="text-xs text-slate-400">to</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-xs py-1" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[10px] text-red-500 font-semibold">Clear</button>
            )}
          </div>
          <span className="text-[10px] text-slate-400 ml-auto">{filteredTasks.length} tasks in range</span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">CSV Exports</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExportTasksCSV} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-all text-left">
                <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Tasks (CSV)</div>
                  <div className="text-[9px] text-slate-400">{filteredTasks.length} tasks</div>
                </div>
              </button>
              <button onClick={handleExportSprintCSV} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-all text-left">
                <FileSpreadsheet className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Iteration Report</div>
                  <div className="text-[9px] text-slate-400">{projectSprints.length} iterations</div>
                </div>
              </button>
              <button onClick={handleExportRoadmapCSV} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-all text-left">
                <FileSpreadsheet className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Roadmap</div>
                  <div className="text-[9px] text-slate-400">Epics + Tasks</div>
                </div>
              </button>
              <button onClick={handleExportReleaseCSV} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-all text-left">
                <FileSpreadsheet className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Releases</div>
                  <div className="text-[9px] text-slate-400">{projectReleases.length} releases</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">XLSX / Excel Exports</div>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={handleExportTasksXLSX} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-green-300 transition-all text-left">
                <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Tasks (XLSX)</div>
                  <div className="text-[9px] text-slate-400">{filteredTasks.length} tasks, spreadsheet format</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">PDF Exports (Real Binary PDF)</div>
            <div className="space-y-2">
              <button onClick={handleExportProjectPDF} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-red-300 transition-all text-left w-full">
                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Project Report (PDF)</div>
                  <div className="text-[9px] text-slate-400">Full project summary, tasks, metrics</div>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <select value={selectedSprintId} onChange={(e) => setSelectedSprintId(e.target.value)} className="input text-xs py-1.5 flex-1">
                  <option value="">Select iteration...</option>
                  {projectSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={handleExportSprintPDF} className="btn-primary btn-xs flex items-center gap-1" disabled={!selectedSprintId}>
                  <FileText className="w-3.5 h-3.5" /> Iteration PDF
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select value={selectedReleaseId} onChange={(e) => setSelectedReleaseId(e.target.value)} className="input text-xs py-1.5 flex-1">
                  <option value="">Select release...</option>
                  {projectReleases.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.version})</option>)}
                </select>
                <button onClick={handleExportReleasePDF} className="btn-primary btn-xs flex items-center gap-1" disabled={!selectedReleaseId}>
                  <FileText className="w-3.5 h-3.5" /> Release PDF
                </button>
              </div>

              <button onClick={handleExportRoadmapPDF} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-red-300 transition-all text-left w-full">
                <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Roadmap Summary (PDF)</div>
                  <div className="text-[9px] text-slate-400">Epics overview, task breakdown</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" /> Export History
        </h3>
        {exportHistory.length > 0 ? (
          <div className="space-y-2">
            {exportHistory.map((record) => (
              <div key={record.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  record.format === 'PDF' ? 'bg-red-50 text-red-500' : record.format === 'XLSX' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-500'
                }`}>
                  {record.format === 'PDF' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{record.filename}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{record.type}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{record.generatedBy}</span>
                    <span>·</span>
                    <span>{new Date(record.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRedownload(record)}
                  className="p-2 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600 transition-colors"
                  title="Re-download"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Download} title="No exports yet" description="Generate an export to see it here" />
        )}
      </div>
    </div>
  );
};
