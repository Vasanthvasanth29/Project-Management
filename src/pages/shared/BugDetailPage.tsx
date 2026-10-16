import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, User, Clock, MessageSquare, Paperclip,
  AlertCircle, Send, Plus, CheckCircle, RefreshCw, XCircle,
  FileText, Bug as BugIcon
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { BugStatusBadge, BugSeverityBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { formatDate, formatTimeAgo } from '../../utils/dateUtils';
import { FileUploadZone } from '../../components/files/FileUploadZone';
import { FileAttachmentList } from '../../components/files/FileAttachmentList';
import { FileVersionHistoryModal } from '../../components/files/FileVersionHistoryModal';
import { StorageUsageBar } from '../../components/files/StorageUsageBar';
import { formatFileSize } from '../../utils/fileConfig';
import { canUploadFiles } from '../../utils/roleUtils';
import { matchId } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import { toast } from 'sonner';

export const BugDetailPage: React.FC = () => {
  const { bugId } = useParams<{ bugId: string }>();
  const navigate = useNavigate();
  const {
    bugs, projects, users, tasks, fileRecords, addFileRecord, removeFileRecord,
    getStorageUsage, updateBugStatus, assignBug
  } = useAppStore();
  const { currentUser } = useAuthStore();

  const [showUploadZone, setShowUploadZone] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
  }[]>([]);
  const [versionHistoryGroupId, setVersionHistoryGroupId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const bug = bugs.find((b) => matchId(b.id, bugId));

  if (!bug) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Bug not found</h2>
        <button className="btn-secondary mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const project = projects.find((p) => p.id === bug.projectId);
  const reporter = users.find((u) => u.id === bug.reportedById);
  const assignee = users.find((u) => u.id === bug.assignedToId);
  const relatedTask = bug.taskId ? tasks.find((t) => t.id === bug.taskId) : null;

  const bugFileRecords = fileRecords.filter((fr) => fr.bugId === bug.id && !fr.isDeleted);
  const storageUsage = getStorageUsage(bug.projectId);

  const handleFilesSelected = (files: File[]) => {
    if (!currentUser) return;
    const newPending = files.map((file) => ({ file, status: 'pending' as const }));
    setPendingFiles((prev) => [...prev, ...newPending]);
    setShowUploadZone(false);

    newPending.forEach((pf) => {
      setPendingFiles((prev) =>
        prev.map((p) => (p.file === pf.file ? { ...p, status: 'uploading' } : p))
      );

      setTimeout(() => {
        const versionGroupId = `vg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        addFileRecord({
          organizationId: 'org-001',
          projectId: bug.projectId,
          bugId: bug.id,
          uploadedById: currentUser.id,
          fileName: pf.file.name,
          originalFileName: pf.file.name,
          fileUrl: `/storage/org-001/${bug.projectId}/${versionGroupId}/${pf.file.name}`,
          fileSize: pf.file.size,
          mimeType: pf.file.type || 'application/octet-stream',
          checksum: `mock-${Date.now()}`,
          version: 1,
          versionGroupId,
          isLatestVersion: true,
          isDeleted: false,
        });

        setPendingFiles((prev) =>
          prev.map((p) => (p.file === pf.file ? { ...p, status: 'success' } : p))
        );
        toast.success(`"${pf.file.name}" uploaded`);
        setTimeout(() => {
          setPendingFiles((prev) => prev.filter((p) => p.file !== pf.file));
        }, 2000);
      }, 800 + Math.random() * 400);
    });
  };

  const removePendingFile = (file: File) => {
    setPendingFiles((prev) => prev.filter((p) => p.file !== file));
  };

  const handleStatusChange = (newStatus: typeof bug.status) => {
    updateBugStatus(bug.id, newStatus);
    toast.success(`Bug status updated to ${newStatus.replace(/_/g, ' ')}`);
  };

  const getPriorityDot = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-amber-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bugs
        </button>
        {relatedTask && (
          <div className="flex items-center gap-2 text-xs bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
            <span className="text-blue-500 font-medium">Related Task:</span>
            <button
              onClick={() => navigate(issuePath(relatedTask))}
              className="font-semibold text-blue-700 hover:underline truncate max-w-[200px]"
            >
              {relatedTask.title}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bug Details, Attachments, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bug Information Card */}
          <div className="card p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#0d9488] uppercase tracking-wider">
                  {project?.name}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{bug.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <BugSeverityBadge severity={bug.severity} />
                <BugStatusBadge status={bug.status} />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-[#1a1d23] leading-tight">{bug.title}</h1>
            <p className="text-sm text-[#6b7280] leading-relaxed whitespace-pre-line">{bug.description}</p>

            {/* Status Actions */}
            <div className="p-4 rounded-xl bg-[#f8f9fb] border border-[#e2e5ea] flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-1">Current Status</div>
                <BugStatusBadge status={bug.status} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {bug.status === 'OPEN' && (
                  <button className="btn-primary btn-sm" onClick={() => handleStatusChange('IN_PROGRESS')}>
                    <RefreshCw className="w-3.5 h-3.5" /> Start Fix
                  </button>
                )}
                {bug.status === 'IN_PROGRESS' && (
                  <button className="btn-primary btn-sm bg-teal-600 hover:bg-teal-700" onClick={() => handleStatusChange('FIXED')}>
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Fixed
                  </button>
                )}
                {bug.status === 'FIXED' && (
                  <button className="btn-secondary btn-sm text-emerald-600" onClick={() => handleStatusChange('CLOSED')}>
                    <CheckCircle className="w-3.5 h-3.5" /> Close
                  </button>
                )}
                {bug.status === 'RETESTING' && (
                  <button className="btn-secondary btn-sm text-blue-600" onClick={() => handleStatusChange('CLOSED')}>
                    <CheckCircle className="w-3.5 h-3.5" /> Verify & Close
                  </button>
                )}
                {bug.status === 'REOPENED' && (
                  <button className="btn-primary btn-sm" onClick={() => handleStatusChange('IN_PROGRESS')}>
                    <RefreshCw className="w-3.5 h-3.5" /> Restart Fix
                  </button>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Severity</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${getPriorityDot(bug.severity)}`} />
                  <span className="font-semibold text-slate-700">{bug.severity}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Reported By</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {reporter && <Avatar name={reporter.name} color={reporter.avatarColor} size="xs" />}
                  <span className="font-semibold text-slate-700">{reporter?.name || 'Unknown'}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned To</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {assignee ? (
                    <>
                      <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                      <span className="font-semibold text-slate-700">{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Reported</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span className="font-semibold text-slate-700">{formatDate(bug.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Steps to Reproduce */}
            {bug.steps && (
              <div className="border-t border-slate-100 pt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Steps to Reproduce</span>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {bug.steps}
                </p>
              </div>
            )}

            {/* Expected / Actual Behavior */}
            {(bug.expectedBehavior || bug.actualBehavior) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                {bug.expectedBehavior && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Expected Result</span>
                    <p className="text-xs text-slate-700 mt-1 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      {bug.expectedBehavior}
                    </p>
                  </div>
                )}
                {bug.actualBehavior && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Actual Result</span>
                    <p className="text-xs text-slate-700 mt-1 bg-red-50 p-3 rounded-lg border border-red-100">
                      {bug.actualBehavior}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base font-bold text-[#1a1d23] flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#0d9488]" /> Attachments ({bugFileRecords.length})
              </h2>
              {canUploadFiles(currentUser?.role || 'MEMBER') && (
                <button
                  type="button"
                  onClick={() => setShowUploadZone(!showUploadZone)}
                  className="btn-secondary btn-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Attach File
                </button>
              )}
            </div>

            {/* Upload Zone */}
            {showUploadZone && (
              <div className="animate-slide-in">
                <FileUploadZone onFilesSelected={handleFilesSelected} bugId={bug.id} />
              </div>
            )}

            {/* Pending Files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      pf.status === 'success' ? 'bg-green-500' :
                      pf.status === 'uploading' ? 'bg-amber-500 animate-pulse' :
                      pf.status === 'error' ? 'bg-red-500' : 'bg-slate-300'
                    }`} />
                    <span className="text-xs font-medium text-slate-700 truncate flex-1">{pf.file.name}</span>
                    <span className="text-[10px] text-slate-400">{formatFileSize(pf.file.size)}</span>
                    {pf.status === 'success' && (
                      <span className="text-[10px] text-green-600 font-medium">Uploaded</span>
                    )}
                    {pf.status === 'uploading' && (
                      <span className="text-[10px] text-amber-600 font-medium">Uploading...</span>
                    )}
                    {pf.status === 'error' && (
                      <span className="text-[10px] text-red-500">{pf.error || 'Failed'}</span>
                    )}
                    {pf.status !== 'uploading' && (
                      <button
                        onClick={() => removePendingFile(pf.file)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <span className="text-xs">×</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* File List */}
            <FileAttachmentList
              files={bugFileRecords}
              canDelete={true}
              onVersionHistory={(vgId) => setVersionHistoryGroupId(vgId)}
            />

            {/* Storage Usage */}
            <div className="pt-3 border-t border-slate-100">
              <StorageUsageBar usage={storageUsage} />
            </div>
          </div>

          {/* Legacy Attachments */}
          {bug.attachments && bug.attachments.length > 0 && (
            <div className="card p-6 space-y-3">
              <h2 className="text-base font-bold text-[#1a1d23] flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Legacy Attachments ({bug.attachments.length})
              </h2>
              <div className="space-y-2">
                {bug.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate flex-1">{att.fileName}</span>
                    <span className="text-[10px] text-slate-400">{formatFileSize(att.fileSize)}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(att.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bug Timeline */}
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              Timeline
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-slate-800">Bug reported</span>
                    <span className="text-[10px] text-slate-400">{formatTimeAgo(bug.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Reported by {reporter?.name || 'Unknown'}
                  </p>
                </div>
              </div>
              {bug.fixedAt && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-800">Bug fixed</span>
                      <span className="text-[10px] text-slate-400">{formatTimeAgo(bug.fixedAt)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-slate-800">Last updated</span>
                    <span className="text-[10px] text-slate-400">{formatTimeAgo(bug.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Info */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Bug Details</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <BugStatusBadge status={bug.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Severity</span>
                <BugSeverityBadge severity={bug.severity} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Project</span>
                <span className="font-semibold text-slate-700">{project?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reporter</span>
                <div className="flex items-center gap-1.5">
                  {reporter && <Avatar name={reporter.name} color={reporter.avatarColor} size="xs" />}
                  <span className="font-semibold text-slate-700">{reporter?.name || 'Unknown'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assignee</span>
                {assignee ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                    <span className="font-semibold text-slate-700">{assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </div>
              {relatedTask && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1">Related Task</span>
                  <button
                    onClick={() => navigate(issuePath(relatedTask))}
                    className="text-left w-full p-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-[10px] font-bold text-blue-600">{relatedTask.id}</span>
                    <p className="text-xs font-semibold text-blue-800 truncate">{relatedTask.title}</p>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Summary */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[#0d9488]" /> Attachments
            </h3>
            <div className="text-center py-4">
              <div className="text-2xl font-bold text-slate-800">{bugFileRecords.length}</div>
              <div className="text-[10px] text-slate-400">file(s) attached</div>
            </div>
            {bugFileRecords.length > 0 && (
              <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
                {bugFileRecords.slice(0, 5).map((fr) => (
                  <div key={fr.id} className="flex items-center gap-2 text-[11px] p-1.5 rounded-lg bg-slate-50">
                    <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 truncate flex-1">{fr.fileName}</span>
                    <span className="text-slate-400 flex-shrink-0">{formatFileSize(fr.fileSize)}</span>
                  </div>
                ))}
                {bugFileRecords.length > 5 && (
                  <div className="text-[10px] text-slate-400 text-center pt-1">
                    +{bugFileRecords.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version History Modal */}
      <FileVersionHistoryModal
        isOpen={versionHistoryGroupId !== null}
        versionGroupId={versionHistoryGroupId}
        onClose={() => setVersionHistoryGroupId(null)}
      />
    </div>
  );
};
