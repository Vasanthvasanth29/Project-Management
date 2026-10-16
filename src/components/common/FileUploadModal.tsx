import React, { useState, useRef } from 'react';
import {
  X, UploadCloud, Link2, File, CheckCircle2, AlertTriangle,
  HardDrive, ShieldAlert, Sparkles, ExternalLink, Loader2
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import {
  formatBytes,
  generateObjectStorageKey,
  detectCloudProvider,
  validateUploadQuota,
  getCategoryBadge
} from '../../utils/storageUtils';
import type { Attachment, AttachmentCategory, AttachmentSource } from '../../types';
import { toast } from 'sonner';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  projectId: string;
  onUploadSuccess?: (attachment: Attachment) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  taskId,
  projectId,
  onUploadSuccess,
}) => {
  const { currentUser } = useAuthStore();
  const {
    organization,
    uploadTaskAttachment,
    getOrganizationStorageStats,
    getUserStorageUsed,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<AttachmentSource>('DIRECT_UPLOAD');
  const [category, setCategory] = useState<AttachmentCategory>('DELIVERABLE');
  const [description, setDescription] = useState('');

  // Direct Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud Link State
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudTitle, setCloudTitle] = useState('');

  if (!isOpen || !currentUser) return null;

  const orgStats = getOrganizationStorageStats();
  const userUsedBytes = getUserStorageUsed(currentUser.id);
  const userQuotaPercent = Math.min(
    100,
    Math.round((userUsedBytes / orgStats.perUserLimitBytes) * 100)
  );

  const resetForm = () => {
    setSelectedFile(null);
    setCloudUrl('');
    setCloudTitle('');
    setDescription('');
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Direct upload submit
  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    // Client-side guardrail pre-check
    const validation = validateUploadQuota({
      fileSizeBytes: selectedFile.size,
      currentOrgUsedBytes: orgStats.usedBytes,
      orgLimitBytes: orgStats.limitBytes,
      currentUserUsedBytes: userUsedBytes,
      userLimitBytes: orgStats.perUserLimitBytes,
      maxFileSizeBytes: orgStats.maxFileSizeBytes,
    });

    if (!validation.allowed) {
      toast.error(validation.reason || 'Storage quota limit exceeded');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    // Simulate presigned S3 direct-upload with progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 25;
      });
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      setUploadProgress(100);

      // Create object storage decoupled S3 key
      const tempId = `${Date.now()}`;
      const storageKey = generateObjectStorageKey(
        organization.id,
        projectId,
        tempId,
        selectedFile.name
      );

      // Create blob URL for inline previewing
      const fileUrl = URL.createObjectURL(selectedFile);

      const res = uploadTaskAttachment(taskId, {
        userId: currentUser.id,
        fileName: selectedFile.name,
        fileUrl,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        storageKey,
        source: 'DIRECT_UPLOAD',
        category,
        version: 1,
        description: description.trim() || undefined,
      });

      setIsUploading(false);

      if (res.success && res.attachment) {
        toast.success(`Attached "${selectedFile.name}" successfully!`);
        if (onUploadSuccess) onUploadSuccess(res.attachment);
        handleClose();
      } else {
        toast.error(res.error || 'Failed to attach file');
      }
    }, 700);
  };

  // Cloud Link submit
  const handleCloudLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    const provider = detectCloudProvider(cloudUrl);
    const fileName =
      cloudTitle.trim() ||
      (provider !== 'OTHER' ? `${provider.replace(/_/g, ' ')} Asset` : 'External Cloud Asset');

    const res = uploadTaskAttachment(taskId, {
      userId: currentUser.id,
      fileName,
      fileUrl: cloudUrl.trim(),
      fileSize: 0, // Cloud links consume 0 bytes of local storage!
      mimeType: 'text/uri-list',
      source: 'CLOUD_LINK',
      category,
      externalProvider: provider,
      description: description.trim() || undefined,
    });

    if (res.success && res.attachment) {
      toast.success(`Linked "${fileName}" (0 bytes storage consumed)!`);
      if (onUploadSuccess) onUploadSuccess(res.attachment);
      handleClose();
    } else {
      toast.error(res.error || 'Failed to attach link');
    }
  };

  // Pre-validate selected file for inline warning
  const fileValidationError = selectedFile
    ? validateUploadQuota({
        fileSizeBytes: selectedFile.size,
        currentOrgUsedBytes: orgStats.usedBytes,
        orgLimitBytes: orgStats.limitBytes,
        currentUserUsedBytes: userUsedBytes,
        userLimitBytes: orgStats.perUserLimitBytes,
        maxFileSizeBytes: orgStats.maxFileSizeBytes,
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Add Task Asset</h2>
              <p className="text-xs text-slate-500">
                Upload direct files or attach zero-footprint cloud links
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota Guardrails Banner */}
        <div className="bg-slate-900 text-slate-200 px-5 py-3 text-xs flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="font-medium text-slate-300">Your Storage Quota: </span>
              <span className="font-bold text-white">
                {formatBytes(userUsedBytes)} / {formatBytes(orgStats.perUserLimitBytes)}
              </span>
              <span className="text-slate-400 ml-1">({userQuotaPercent}% used)</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 rounded text-[11px] text-blue-300 border border-slate-700">
            <span>Cap: {formatBytes(orgStats.maxFileSizeBytes)}/file</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('DIRECT_UPLOAD')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'DIRECT_UPLOAD'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            <span>Direct S3/R2 Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CLOUD_LINK')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'CLOUD_LINK'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-4 h-4 text-purple-600" />
            <span>Cloud Storage Link</span>
            <span className="bg-emerald-100 text-emerald-800 font-semibold text-[10px] px-1.5 py-0.2 rounded-full">
              0 bytes
            </span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Deliverable Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                ['DELIVERABLE', 'SPEC', 'DESIGN', 'DOCUMENT', 'PROOF'] as AttachmentCategory[]
              ).map((cat) => {
                const badge = getCategoryBadge(cat);
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                      isSelected
                        ? `${badge.bg} ${badge.text} ring-2 ring-blue-500/20 font-bold shadow-xs`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {badge.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: DIRECT UPLOAD */}
          {activeTab === 'DIRECT_UPLOAD' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-blue-300 bg-blue-50/30'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                      <File className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 break-all">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatBytes(selectedFile.size)} • Click or drop to replace
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Click to browse or drag file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Max file size cap: {formatBytes(orgStats.maxFileSizeBytes)}
                    </p>
                  </div>
                )}
              </div>

              {/* Validation Warning Alert */}
              {fileValidationError && !fileValidationError.allowed && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-shake">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Upload Blocked: </span>
                    <span>{fileValidationError.reason}</span>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-1.5 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      Presigned URL direct transmission...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Optional Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Version Notes (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Final signed off mockup from Iteration 2"
                  className="input-field text-xs"
                />
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleDirectUpload}
                disabled={Boolean(
                  !selectedFile ||
                  isUploading ||
                  (fileValidationError && !fileValidationError.allowed)
                )}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading directly to Object Storage...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Attach File</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: CLOUD LINK */}
          {activeTab === 'CLOUD_LINK' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-xs text-purple-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Zero Storage Footprint</p>
                  <p className="text-purple-700 mt-0.5">
                    Link work directly from Figma, Google Drive, OneDrive, or Dropbox. Links consume 0 MB of your account quota!
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Resource URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    placeholder="https://figma.com/file/... or https://drive.google.com/..."
                    className="input-field text-xs pl-8"
                    required
                  />
                  <ExternalLink className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title / Asset Label
                </label>
                <input
                  type="text"
                  value={cloudTitle}
                  onChange={(e) => setCloudTitle(e.target.value)}
                  placeholder="e.g. Figma Mobile Design System v2"
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Context (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Client view-only link for staging review"
                  className="input-field text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleCloudLinkSubmit}
                disabled={!cloudUrl.trim()}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 border-purple-600 disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                <span>Attach Cloud Link</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
