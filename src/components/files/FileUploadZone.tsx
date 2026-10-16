import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { validateFile, formatFileSize, getFileExtension, FILE_CONFIG, detectDuplicateFile } from '../../utils/fileConfig';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  taskId?: string;
  bugId?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onFilesSelected, disabled, taskId, bugId }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fileRecords } = useAppStore();

  const existingFiles = fileRecords
    .filter((fr) => !fr.isDeleted && (taskId ? fr.taskId === taskId : bugId ? fr.bugId === bugId : false))
    .map((fr) => ({ fileName: fr.originalFileName, fileSize: fr.fileSize }));

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const result = validateFile(file);

      if (!result.valid) {
        errors.push(`${file.name}: ${result.error}`);
        continue;
      }

      const duplicateCheck = detectDuplicateFile(file.name, file.size, existingFiles);
      if (duplicateCheck.isDuplicate) {
        errors.push(`${file.name}: Duplicate file (same name and size already attached)`);
        continue;
      }
      if (duplicateCheck.isVersion) {
        toast.info(`"${file.name}" will be uploaded as a new version of an existing file`);
      }

      validFiles.push(file);
    }

    setValidationErrors(errors);
    if (errors.length > 0 && validFiles.length === 0) {
      toast.error(`${errors.length} file(s) failed validation`);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected, existingFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' :
            isDragOver ? 'border-[#0d9488] bg-[#f0fdfa]' : 'border-slate-200 bg-slate-50/50 hover:border-[#0d9488]/50 hover:bg-[#f0fdfa]/50'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDragOver ? 'bg-[#ccfbf1] text-[#0d9488]' : 'bg-slate-100 text-slate-400'}`}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {isDragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Max {FILE_CONFIG.MAX_FILE_SIZE_MB} MB per file
            </p>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 space-y-1">
          {validationErrors.map((error, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-red-600">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
