import React, { useState } from 'react';
import {
  FileIcon, Download, Trash2, Eye, ChevronDown, ChevronRight,
  Clock, User, MoreVertical, History
} from 'lucide-react';
import { formatFileSize, getFileCategory, canPreviewFile as canPreviewFileType } from '../../utils/fileConfig';
import { formatDate } from '../../utils/dateUtils';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { canDeleteFile } from '../../utils/roleUtils';
import { toast } from 'sonner';
import type { FileRecord } from '../../types';

interface FileItemProps {
  record: FileRecord;
  onVersionHistory?: (versionGroupId: string) => void;
  canDelete?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  image: 'bg-blue-100 text-blue-600',
  pdf: 'bg-red-100 text-red-600',
  document: 'bg-indigo-100 text-indigo-600',
  spreadsheet: 'bg-green-100 text-green-600',
  presentation: 'bg-orange-100 text-orange-600',
  text: 'bg-slate-100 text-slate-600',
  archive: 'bg-amber-100 text-amber-600',
  video: 'bg-purple-100 text-purple-600',
  audio: 'bg-pink-100 text-pink-600',
  other: 'bg-slate-100 text-slate-500',
};

export const FileItem: React.FC<FileItemProps> = ({ record, onVersionHistory, canDelete: canDeleteProp = true }) => {
  const { currentUser } = useAuthStore();
  const { users, removeFileRecord, fileRecords } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);

  const uploader = users.find((u) => u.id === record.uploadedById);
  const category = getFileCategory(record.mimeType);
  const iconClass = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;

  const hasMultipleVersions = fileRecords.filter(
    (fr) => fr.versionGroupId === record.versionGroupId && !fr.isDeleted
  ).length > 1;

  const userRole = currentUser?.role || 'MEMBER';
  const isAllowedToDelete = canDeleteProp && currentUser && canDeleteFile(userRole, record, currentUser.id);
  const isPreviewable = canPreviewFileType(record.mimeType);

  const handleDelete = () => {
    if (!currentUser) return;
    removeFileRecord(record.id, currentUser.id);
    toast.success(`"${record.fileName}" deleted`);
    setShowMenu(false);
  };

  const handleDownload = () => {
    toast.success(`Downloading "${record.fileName}"...`);
    setShowMenu(false);
  };

  const handlePreview = () => {
    toast.info(`Preview for "${record.fileName}"`);
    setShowMenu(false);
  };

  const handleVersionHistory = () => {
    if (onVersionHistory) {
      onVersionHistory(record.versionGroupId);
    }
    setShowMenu(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
      {/* File type icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <FileIcon className="w-4 h-4" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 truncate">{record.fileName}</span>
          {!record.isLatestVersion && (
            <span className="badge-gray text-[9px] px-1.5 py-0.5">v{record.version}</span>
          )}
          {record.isLatestVersion && record.version > 1 && (
            <span className="badge-teal text-[9px] px-1.5 py-0.5">latest</span>
          )}
          {record.version === 1 && !hasMultipleVersions && (
            <span className="text-[9px] text-slate-400">v1</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <User className="w-3 h-3" /> {uploader?.name || 'Unknown'}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatDate(record.createdAt)}
          </span>
          <span className="text-[11px] text-slate-400">{formatFileSize(record.fileSize)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isPreviewable && (
          <button
            onClick={handlePreview}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {hasMultipleVersions && onVersionHistory && (
          <button
            onClick={handleVersionHistory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
            title="Version History"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {isAllowedToDelete && (
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
