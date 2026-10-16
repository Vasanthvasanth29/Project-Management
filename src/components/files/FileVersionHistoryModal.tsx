import React from 'react';
import { X, Download, Clock, User, FileIcon, Eye } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatFileSize, canPreviewFile } from '../../utils/fileConfig';
import { formatDate } from '../../utils/dateUtils';
import { toast } from 'sonner';
import type { FileRecord } from '../../types';

interface FileVersionHistoryModalProps {
  isOpen: boolean;
  versionGroupId: string | null;
  onClose: () => void;
}

export const FileVersionHistoryModal: React.FC<FileVersionHistoryModalProps> = ({
  isOpen,
  versionGroupId,
  onClose,
}) => {
  const { fileRecords, users } = useAppStore();

  if (!isOpen || !versionGroupId) return null;

  const versions = fileRecords
    .filter((fr) => fr.versionGroupId === versionGroupId && !fr.isDeleted)
    .sort((a, b) => b.version - a.version);

  if (versions.length === 0) return null;

  const firstVersion = versions[versions.length - 1];
  const isPreviewable = versions.length > 0 && canPreviewFile(versions[0].mimeType);

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4]">
          <div>
            <h3 className="text-base font-bold text-[#1a1d23]">Version History</h3>
            <p className="text-xs text-[#9ca3af] mt-0.5">{firstVersion?.originalFileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-[#747775] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version list */}
        <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-thin space-y-2">
          {versions.map((version, idx) => {
            const uploader = users.find((u) => u.id === version.uploadedById);
            const canPreviewVersion = canPreviewFile(version.mimeType);
            return (
              <div
                key={version.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  version.isLatestVersion
                    ? 'bg-[#f0fdfa] border-[#99f6e4]'
                    : 'bg-white border-slate-100'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      Version {version.version}
                    </span>
                    {version.isLatestVersion && (
                      <span className="badge-teal text-[9px] px-1.5 py-0.5">latest</span>
                    )}
                    {idx === versions.length - 1 && !version.isLatestVersion && (
                      <span className="badge-gray text-[9px] px-1.5 py-0.5">original</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <User className="w-3 h-3" /> {uploader?.name || 'Unknown'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(version.createdAt)}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatFileSize(version.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canPreviewVersion && (
                    <button
                      onClick={() => {
                        toast.info(`Previewing version ${version.version} of "${version.fileName}"`);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Preview this version"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      toast.success(`Downloading version ${version.version}...`);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
                    title="Download this version"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-[#f1f3f4] bg-[#f8fafd]">
          <p className="text-[10px] text-slate-400 text-center">
            {versions.length} version{versions.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    </div>
  );
};
