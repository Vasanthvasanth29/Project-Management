import type { AttachmentCategory, ExternalCloudProvider } from '../types';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const DEFAULT_USER_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const DEFAULT_ORG_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

/**
 * Formats byte values into human-readable strings (e.g., 24.5 MB, 1.8 GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Generates an isolated multi-tenant object storage path (S3 / Cloudflare R2 structure):
 * s3://saas-bucket/tenant_{tenantId}/projects/{projectId}/attachments/{attachmentId}_{cleanFileName}
 */
export function generateObjectStorageKey(
  tenantId: string,
  projectId: string,
  attachmentId: string,
  fileName: string
): string {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const orgPrefix = tenantId || 'tenant_default';
  const projPrefix = projectId || 'shared_space';
  return `s3://invictus-storage/${orgPrefix}/projects/${projPrefix}/attachments/${attachmentId}_${cleanName}`;
}

/**
 * Detects cloud storage providers from URLs.
 */
export function detectCloudProvider(url: string): ExternalCloudProvider {
  const lowercase = url.toLowerCase();
  if (lowercase.includes('drive.google.com') || lowercase.includes('docs.google.com')) {
    return 'GOOGLE_DRIVE';
  }
  if (lowercase.includes('figma.com')) {
    return 'FIGMA';
  }
  if (lowercase.includes('dropbox.com')) {
    return 'DROPBOX';
  }
  if (lowercase.includes('sharepoint.com') || lowercase.includes('onedrive.live.com')) {
    return 'ONEDRIVE';
  }
  if (lowercase.includes('notion.so') || lowercase.includes('notion.site')) {
    return 'NOTION';
  }
  return 'OTHER';
}

export interface QuotaCheckParams {
  fileSizeBytes: number;
  currentOrgUsedBytes: number;
  orgLimitBytes: number;
  currentUserUsedBytes: number;
  userLimitBytes: number;
  maxFileSizeBytes?: number;
}

export interface QuotaValidationResult {
  allowed: boolean;
  reason?: string;
  type?: 'FILE_SIZE' | 'USER_QUOTA' | 'ORG_QUOTA';
}

/**
 * Strict quota guardrail validator:
 * 1. Checks file size against per-file cap.
 * 2. Checks user storage against per-user cap.
 * 3. Checks organization storage against tenant quota.
 */
export function validateUploadQuota(params: QuotaCheckParams): QuotaValidationResult {
  const maxFileSize = params.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES;
  const userLimit = params.userLimitBytes || DEFAULT_USER_STORAGE_LIMIT_BYTES;
  const orgLimit = params.orgLimitBytes || DEFAULT_ORG_STORAGE_LIMIT_BYTES;

  // 1. Check Per-File Cap
  if (params.fileSizeBytes > maxFileSize) {
    return {
      allowed: false,
      type: 'FILE_SIZE',
      reason: `File size (${formatBytes(params.fileSizeBytes)}) exceeds the maximum allowed limit of ${formatBytes(maxFileSize)} per file.`,
    };
  }

  // 2. Check Per-User Quota
  if (params.currentUserUsedBytes + params.fileSizeBytes > userLimit) {
    const remaining = Math.max(0, userLimit - params.currentUserUsedBytes);
    return {
      allowed: false,
      type: 'USER_QUOTA',
      reason: `Uploading this file exceeds your personal storage quota (${formatBytes(userLimit)}). Remaining balance: ${formatBytes(remaining)}.`,
    };
  }

  // 3. Check Tenant Quota
  if (params.currentOrgUsedBytes + params.fileSizeBytes > orgLimit) {
    const remaining = Math.max(0, orgLimit - params.currentOrgUsedBytes);
    return {
      allowed: false,
      type: 'ORG_QUOTA',
      reason: `Organization storage limit reached (${formatBytes(orgLimit)}). Please ask an Admin to upgrade storage. Remaining balance: ${formatBytes(remaining)}.`,
    };
  }

  return { allowed: true };
}

/**
 * Returns a friendly category label and color.
 */
export function getCategoryBadge(category?: AttachmentCategory): { label: string; bg: string; text: string } {
  switch (category) {
    case 'DELIVERABLE':
      return { label: 'Deliverable', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' };
    case 'DESIGN':
      return { label: 'Design Asset', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' };
    case 'SPEC':
      return { label: 'Specification', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' };
    case 'PROOF':
      return { label: 'Bug Proof', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' };
    case 'DOCUMENT':
      return { label: 'Document', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700' };
    default:
      return { label: 'Attachment', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' };
  }
}
