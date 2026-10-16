import React from 'react';
import {
  X, Download, ExternalLink, FileText, HardDrive, User,
  Calendar, ShieldCheck, Image as ImageIcon, Layers
} from 'lucide-react';
import { formatBytes, getCategoryBadge } from '../../utils/storageUtils';
import type { Attachment, User as UserType } from '../../types';
import { Avatar } from './Avatar';
import { formatDate } from '../../utils/dateUtils';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
  uploader?: UserType;
  taskTitle?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  attachment,
  uploader,
  taskTitle,
}) => {
  if (!isOpen || !attachment) return null;

  const isImage =
    attachment.mimeType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.fileName);

  const isCloudLink = attachment.source === 'CLOUD_LINK';
  const badge = getCategoryBadge(attachment.category);

  const handleDownload = () => {
    if (isCloudLink) {
      window.open(attachment.fileUrl, '_blank');
      return;
    }

    const a = document.createElement('a');
    a.href = attachment.fileUrl;
    a.download = attachment.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 truncate">
                  {attachment.fileName}
                </h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} shrink-0`}>
                  {badge.label}
                </span>
              </div>
              {taskTitle && (
                <p className="text-xs text-slate-500 truncate">
                  Attached to: <span className="font-semibold text-slate-700">{taskTitle}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              {isCloudLink ? (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Resource</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/5 flex flex-col items-center justify-center min-h-[300px]">
          {isImage ? (
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200/80 bg-white max-h-[480px] max-w-full flex items-center justify-center">
              <img
                src={attachment.fileUrl}
                alt={attachment.fileName}
                className="max-h-[480px] max-w-full object-contain"
              />
            </div>
          ) : isCloudLink ? (
            <div className="card p-8 text-center max-w-md bg-white border border-purple-100 shadow-md">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 border border-purple-100">
                <ExternalLink className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                External Cloud Asset
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                This deliverable is hosted externally on{' '}
                <span className="font-semibold text-purple-700">
                  {attachment.externalProvider || 'Cloud Storage'}
                </span>
                . It consumes 0 MB of your account quota.
              </p>
              <a
                href={attachment.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 border-purple-600"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in {attachment.externalProvider || 'Browser'}</span>
              </a>
            </div>
          ) : (
            <div className="card p-8 text-center max-w-md bg-white border border-slate-200 shadow-md">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {attachment.fileName}
              </h3>
              <p className="text-xs text-slate-500 mb-2">
                Format: {attachment.mimeType} • Size: {formatBytes(attachment.fileSize)}
              </p>
              {attachment.description && (
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-5 italic">
                  "{attachment.description}"
                </p>
              )}
              <button
                onClick={handleDownload}
                className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Attachment</span>
              </button>
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {uploader && (
              <div className="flex items-center gap-2">
                <Avatar name={uploader.name} color={uploader.avatarColor} size="xs" />
                <span>
                  Uploaded by <strong className="text-slate-800">{uploader.name}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(attachment.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Layers className="w-3.5 h-3.5" />
              <span>
                {attachment.source === 'CLOUD_LINK'
                  ? 'Cloud Linked (0 B)'
                  : formatBytes(attachment.fileSize)}
              </span>
            </div>
          </div>

          {attachment.storageKey && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
              <HardDrive className="w-3 h-3 text-blue-500" />
              <span className="truncate max-w-[280px]">{attachment.storageKey}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
