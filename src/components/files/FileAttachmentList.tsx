import React from 'react';
import { Paperclip, Plus, Upload } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';
import { FileItem } from './FileItem';
import { useAuthStore } from '../../store/authStore';
import { canUploadFiles } from '../../utils/roleUtils';
import type { FileRecord } from '../../types';

interface FileAttachmentListProps {
  files: FileRecord[];
  onUploadClick?: () => void;
  canDelete?: boolean;
  onVersionHistory?: (versionGroupId: string) => void;
}

export const FileAttachmentList: React.FC<FileAttachmentListProps> = ({
  files,
  onUploadClick,
  canDelete = true,
  onVersionHistory,
}) => {
  const { currentUser } = useAuthStore();
  const userRole = currentUser?.role || 'MEMBER';
  const canUpload = canUploadFiles(userRole);

  if (files.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No attachments"
        description="Upload files to attach them to this task."
        action={onUploadClick && canUpload ? { label: 'Attach File', onClick: onUploadClick } : undefined}
      />
    );
  }

  return (
    <div className="space-y-2">
      {files.map((record) => (
        <FileItem
          key={record.id}
          record={record}
          canDelete={canDelete}
          onVersionHistory={onVersionHistory}
        />
      ))}
    </div>
  );
};
