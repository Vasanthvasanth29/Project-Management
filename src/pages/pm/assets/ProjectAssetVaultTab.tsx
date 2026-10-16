import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive, Search, Filter, Download, ExternalLink, FileText,
  Image as ImageIcon, Trash2, Eye, Plus, CheckCircle2, Layers,
  LayoutGrid, List, ArrowUpRight, ShieldCheck, Sparkles, FolderArchive
} from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { formatBytes, getCategoryBadge } from '../../../utils/storageUtils';
import type { Attachment, AttachmentCategory, AttachmentSource } from '../../../types';
import { Avatar } from '../../../components/common/Avatar';
import { formatDate } from '../../../utils/dateUtils';
import { displayStatusLabel } from '../../../utils/roleUtils';
import { issuePath } from '../../../utils/issueUrl';
import { FilePreviewModal } from '../../../components/common/FilePreviewModal';
import { toast } from 'sonner';

interface ProjectAssetVaultTabProps {
  projectId: string;
}

interface ProjectAssetItem extends Attachment {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
}

export const ProjectAssetVaultTab: React.FC<ProjectAssetVaultTabProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const { tasks, users, deleteTaskAttachment } = useAppStore();
  const { currentUser } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [previewItem, setPreviewItem] = useState<ProjectAssetItem | null>(null);

  // Aggregate all attachments across this project's tasks
  const projectAssets = useMemo<ProjectAssetItem[]>(() => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const list: ProjectAssetItem[] = [];

    projectTasks.forEach((t) => {
      if (t.attachments && t.attachments.length > 0) {
        t.attachments.forEach((att) => {
          list.push({
            ...att,
            taskId: t.id,
            taskTitle: t.title,
            taskStatus: displayStatusLabel(t),
          });
        });
      }
    });

    // Sort newest first
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [tasks, projectId]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return projectAssets.filter((item) => {
      const matchesSearch =
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      const matchesSource =
        selectedSource === 'ALL' || item.source === selectedSource;

      return matchesSearch && matchesCat && matchesSource;
    });
  }, [projectAssets, searchQuery, selectedCategory, selectedSource]);

  // Aggregate stats
  const totalBytes = projectAssets.reduce(
    (acc, cur) => acc + (cur.source !== 'CLOUD_LINK' ? cur.fileSize : 0),
    0
  );
  const directUploadsCount = projectAssets.filter((a) => a.source !== 'CLOUD_LINK').length;
  const cloudLinksCount = projectAssets.filter((a) => a.source === 'CLOUD_LINK').length;
  const deliverablesCount = projectAssets.filter((a) => a.category === 'DELIVERABLE').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Assets</p>
            <p className="text-lg font-bold text-slate-900">{projectAssets.length}</p>
          </div>
        </div>

        <div className="card p-4 bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Storage Consumed</p>
            <p className="text-lg font-bold text-slate-900">{formatBytes(totalBytes)}</p>
          </div>
        </div>

        <div className="card p-4 bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Zero-Footprint Links</p>
            <p className="text-lg font-bold text-purple-700">{cloudLinksCount}</p>
          </div>
        </div>

        <div className="card p-4 bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Final Deliverables</p>
            <p className="text-lg font-bold text-emerald-700">{deliverablesCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name, description, or task..."
              className="input-field text-xs pl-9 py-2"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field text-xs py-2 w-36"
          >
            <option value="ALL">All Categories</option>
            <option value="DELIVERABLE">Deliverables</option>
            <option value="SPEC">Specifications</option>
            <option value="DESIGN">Design Assets</option>
            <option value="DOCUMENT">Documents</option>
            <option value="PROOF">Bug Proofs</option>
          </select>

          {/* Source Dropdown */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="input-field text-xs py-2 w-36"
          >
            <option value="ALL">All Storage Types</option>
            <option value="DIRECT_UPLOAD">Direct S3/R2</option>
            <option value="CLOUD_LINK">External Cloud Links</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'GRID'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              title="Table View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Asset Collection Display */}
      {filteredAssets.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-slate-200">
          <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No project assets found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'ALL' || selectedSource !== 'ALL'
              ? 'No deliverables match your active filter criteria. Try resetting filters.'
              : 'Attachments and deliverables uploaded to tasks in this project will automatically be indexed here.'}
          </p>
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((item) => {
            const uploader = users.find((u) => u.id === item.userId);
            const isCloud = item.source === 'CLOUD_LINK';
            const badge = getCategoryBadge(item.category);
            const isImage =
              item.mimeType.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|svg)$/i.test(item.fileName);

            return (
              <div
                key={item.id}
                className="card p-4 bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isCloud
                            ? 'bg-purple-50 text-purple-600'
                            : isImage
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isCloud ? (
                          <ExternalLink className="w-5 h-5" />
                        ) : isImage ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4
                          onClick={() => setPreviewItem(item)}
                          className="text-xs font-bold text-slate-800 hover:text-blue-600 truncate cursor-pointer"
                          title={item.fileName}
                        >
                          {item.fileName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isCloud ? 'Cloud Link' : formatBytes(item.fileSize)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!isCloud ? (
                        <a
                          href={item.fileUrl}
                          download={item.fileName}
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-slate-100"
                          title="Open Link"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Task Linkage */}
                  <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 truncate">
                      Task:{' '}
                      <button
                        onClick={() => navigate(issuePath(item.taskId))}
                        className="font-semibold text-slate-700 hover:text-blue-600 hover:underline"
                      >
                        {item.taskTitle}
                      </button>
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-700 shrink-0">
                      {item.taskStatus}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic">
                      "{item.description}"
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={uploader?.name || 'User'} color={uploader?.avatarColor} size="xs" />
                    <span className="truncate max-w-[110px]">{uploader?.name}</span>
                  </div>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card overflow-hidden bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Asset Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Associated Task</th>
                  <th className="py-3 px-4">Uploader</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((item) => {
                  const uploader = users.find((u) => u.id === item.userId);
                  const isCloud = item.source === 'CLOUD_LINK';
                  const badge = getCategoryBadge(item.category);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="flex items-center gap-2 hover:text-blue-600 text-left"
                        >
                          {isCloud ? (
                            <ExternalLink className="w-4 h-4 text-purple-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[220px]">{item.fileName}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {isCloud ? 'Cloud Link' : formatBytes(item.fileSize)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => navigate(issuePath(item.taskId))}
                          className="text-slate-700 hover:text-blue-600 hover:underline truncate max-w-[180px] block font-medium"
                        >
                          {item.taskTitle}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={uploader?.name || 'User'} color={uploader?.avatarColor} size="xs" />
                          <span>{uploader?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(item.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isCloud ? (
                            <a
                              href={item.fileUrl}
                              download={item.fileName}
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-slate-100"
                              title="Open External Resource"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        attachment={previewItem}
        uploader={users.find((u) => u.id === previewItem?.userId)}
        taskTitle={previewItem?.taskTitle}
      />
    </div>
  );
};
