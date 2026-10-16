import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug as BugIcon, Plus, Search, Filter, ChevronDown, ChevronRight, Clock, MessageSquare, Paperclip, FileIcon, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { BugStatusBadge, BugSeverityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate, formatTimeAgo } from '../../utils/dateUtils';
import { formatFileSize, getFileCategory } from '../../utils/fileConfig';
import { displayStatusLabel } from '../../utils/roleUtils';
import { toUrlId } from '../../utils/idUtils';
import { toast } from 'sonner';
import type { BugStatus, BugSeverity } from '../../types';

export const BugsPage: React.FC = () => {
  const navigate = useNavigate();
  const { bugs, users, projects, tasks, fileRecords, updateBugStatus, assignBug } = useAppStore();
  const { currentUser } = useAuthStore();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'ALL'>('ALL');
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);

  const filteredBugs = useMemo(() => {
    let result = bugs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
    }
    if (severityFilter !== 'ALL') result = result.filter((b) => b.severity === severityFilter);
    if (statusFilter !== 'ALL') result = result.filter((b) => b.status === statusFilter);
    return result;
  }, [bugs, search, severityFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: bugs.length,
    open: bugs.filter((b) => b.status === 'OPEN').length,
    inProgress: bugs.filter((b) => b.status === 'IN_PROGRESS').length,
    fixed: bugs.filter((b) => b.status === 'FIXED').length,
    critical: bugs.filter((b) => b.severity === 'CRITICAL' && b.status !== 'CLOSED').length,
  }), [bugs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Bug Tracking & Rework</h1>
        <p className="page-subtitle">Track reported bugs, assign fixes, and verify re-testing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{stats.total}</div>
          <div className="text-[10px] text-slate-500">Total Bugs</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{stats.open}</div>
          <div className="text-[10px] text-slate-500">Open</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-[10px] text-slate-500">In Progress</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-emerald-600">{stats.fixed}</div>
          <div className="text-[10px] text-slate-500">Fixed</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-red-600">{stats.critical}</div>
          <div className="text-[10px] text-slate-500">Critical Open</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search bugs by title, description, or ID..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 w-full" />
        </div>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as BugSeverity | 'ALL')} className="select text-xs py-1.5">
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BugStatus | 'ALL')} className="select text-xs py-1.5">
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="FIXED">Fixed</option>
          <option value="RETESTING">Retesting</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>
        <span className="text-xs text-slate-400">{filteredBugs.length} bug{filteredBugs.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card overflow-hidden">
        {filteredBugs.length === 0 ? (
          <EmptyState icon={BugIcon} title="No bugs reported" description={search || severityFilter !== 'ALL' || statusFilter !== 'ALL' ? "Try adjusting your filters" : "All clear! No open work items or rework items."} />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredBugs.map((bug) => {
              const project = projects.find((p) => p.id === bug.projectId);
              const reporter = users.find((u) => u.id === bug.reportedById);
              const assignee = users.find((u) => u.id === bug.assignedToId);
              const relatedTask = bug.taskId ? tasks.find((t) => t.id === bug.taskId) : null;
              const isExpanded = expandedBugId === bug.id;

              return (
                <div key={bug.id} className="hover:bg-slate-50 transition-colors">
                  {/* Bug Row */}
                  <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpandedBugId(isExpanded ? null : bug.id)}>
                    <button className="flex-shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-400">{bug.id}</span>
                        <span className="text-sm font-semibold text-slate-800 truncate">{bug.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{project?.name || '—'}</span>
                        {bug.steps && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />Has steps</span>}
                        {bug.attachments && bug.attachments.length > 0 && <span className="flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{bug.attachments.length}</span>}
                        {fileRecords.filter((fr) => fr.bugId === bug.id && !fr.isDeleted).length > 0 && (
                          <span className="flex items-center gap-0.5"><FileIcon className="w-3 h-3" />{fileRecords.filter((fr) => fr.bugId === bug.id && !fr.isDeleted).length}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <BugSeverityBadge severity={bug.severity} />
                      <BugStatusBadge status={bug.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-32">
                      {reporter && (
                        <div className="flex items-center gap-1" title={`Reported by ${reporter.name}`}>
                          <Avatar name={reporter.name} color={reporter.avatarColor} size="xs" />
                          <span className="text-[10px] text-slate-500 hidden xl:inline">{reporter.name.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-32">
                      {assignee ? (
                        <div className="flex items-center gap-1" title={`Assigned to ${assignee.name}`}>
                          <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                          <span className="text-[10px] text-slate-500 hidden xl:inline">{assignee.name.split(' ')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                    <div className="flex-shrink-0 w-20">
                      {bug.status === 'OPEN' && (
                        <button className="btn-primary btn-sm text-[10px]" onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'IN_PROGRESS'); toast.success('Bug marked In Progress'); }}>
                          Start Fix
                        </button>
                      )}
                      {bug.status === 'IN_PROGRESS' && (
                        <button className="btn-primary btn-sm text-[10px] bg-teal-600 hover:bg-teal-700" onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'FIXED'); toast.success('Bug marked Fixed'); }}>
                          Mark Fixed
                        </button>
                      )}
                      {bug.status === 'FIXED' && (
                        <button className="btn-secondary btn-sm text-[10px] text-emerald-600" onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'CLOSED'); toast.success('Bug closed!'); }}>
                          Close
                        </button>
                      )}
                      {bug.status === 'RETESTING' && (
                        <button className="btn-secondary btn-sm text-[10px] text-blue-600" onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'CLOSED'); toast.success('Bug verified and closed!'); }}>
                          Verify
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-12 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Severity</span>
                          <div className="mt-0.5"><BugSeverityBadge severity={bug.severity} /></div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                          <div className="mt-0.5"><BugStatusBadge status={bug.status} /></div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Reported</span>
                          <div className="mt-0.5 text-slate-700">{formatDate(bug.createdAt)}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Last Updated</span>
                          <div className="mt-0.5 text-slate-700">{formatTimeAgo(bug.updatedAt)}</div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Description</span>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">{bug.description}</p>
                      </div>

                      {bug.steps && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Steps to Reproduce</span>
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap bg-slate-50 p-2.5 rounded-lg border border-slate-100">{bug.steps}</p>
                        </div>
                      )}

                      {bug.expectedBehavior && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Expected Result</span>
                            <p className="text-xs text-slate-700 mt-1 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">{bug.expectedBehavior}</p>
                          </div>
                          {bug.actualBehavior && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Actual Result</span>
                              <p className="text-xs text-slate-700 mt-1 bg-red-50 p-2.5 rounded-lg border border-red-100">{bug.actualBehavior}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {relatedTask && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                          <span className="text-[10px] font-bold text-blue-600">Related Task:</span>
                          <span className="font-medium">{relatedTask.title}</span>
                          <span className="text-blue-400">({displayStatusLabel(relatedTask)})</span>
                        </div>
                      )}

                      {bug.attachments && bug.attachments.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Attachments ({bug.attachments.length})</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {bug.attachments.map((att) => (
                              <span key={att.id} className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-600 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />{att.fileName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const bugFileRecords = fileRecords.filter((fr) => fr.bugId === bug.id && !fr.isDeleted);
                        if (bugFileRecords.length === 0) return null;
                        return (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">File Records ({bugFileRecords.length})</span>
                            <div className="space-y-1.5 mt-1">
                              {bugFileRecords.map((fr) => {
                                const category = getFileCategory(fr.mimeType);
                                const uploader = users.find((u) => u.id === fr.uploadedById);
                                return (
                                  <div key={fr.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                    <FileIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[11px] font-medium text-slate-700 truncate flex-1">{fr.fileName}</span>
                                    <span className="text-[10px] text-slate-400">{formatFileSize(fr.fileSize)}</span>
                                    <span className="text-[10px] text-slate-400">{uploader?.name || 'Unknown'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/bugs/${toUrlId(bug.id)}`);
                        }}
                        className="btn-secondary btn-xs flex items-center gap-1.5 mt-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Full Details & Attach Files
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
