import React, { useState } from 'react';
import {
  HardDrive, CheckCircle2, AlertTriangle, ShieldCheck, Zap,
  UploadCloud, Link2, Sparkles, TrendingUp, Users, ArrowUpRight,
  Database, Sliders, Check
} from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { formatBytes } from '../../../utils/storageUtils';
import { Avatar } from '../../../components/common/Avatar';
import type { StoragePlan } from '../../../types';
import { toast } from 'sonner';

export const StorageSettingsTab: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    organization,
    users,
    tasks,
    getOrganizationStorageStats,
    getUserStorageUsed,
    updateOrganizationStoragePlan,
    updateStorageCaps,
  } = useAppStore();

  const isAdmin = currentUser?.role === 'ADMIN';
  const orgStats = getOrganizationStorageStats();

  const [selectedPlan, setSelectedPlan] = useState<StoragePlan>(
    organization.storagePlan || 'STARTER'
  );
  const [maxFileCapMb, setMaxFileCapMb] = useState<number>(
    Math.round(orgStats.maxFileSizeBytes / (1024 * 1024))
  );
  const [userQuotaGb, setUserQuotaGb] = useState<number>(
    Math.round(orgStats.perUserLimitBytes / (1024 * 1024 * 1024))
  );

  // Compute stats across tasks
  const allDirectAttachments = tasks.flatMap((t) =>
    (t.attachments || []).filter((a) => a.source !== 'CLOUD_LINK')
  );
  const allCloudAttachments = tasks.flatMap((t) =>
    (t.attachments || []).filter((a) => a.source === 'CLOUD_LINK')
  );

  // Member storage breakdown
  const memberStorage = users.map((u) => {
    const userFiles = allDirectAttachments.filter((a) => a.userId === u.id);
    const userBytes = getUserStorageUsed(u.id);
    const pct = Math.min(100, Math.round((userBytes / orgStats.perUserLimitBytes) * 100));
    return {
      user: u,
      fileCount: userFiles.length,
      usedBytes: userBytes,
      pct,
    };
  }).sort((a, b) => b.usedBytes - a.usedBytes);

  const handlePlanChange = (plan: StoragePlan) => {
    if (!isAdmin) {
      toast.error('Only Administrators can modify organization billing plans');
      return;
    }
    setSelectedPlan(plan);
    updateOrganizationStoragePlan(plan);
    toast.success(`Organization upgraded to ${plan} Plan!`);
  };

  const handleSaveGuardrails = () => {
    if (!isAdmin) {
      toast.error('Only Administrators can configure storage guardrails');
      return;
    }
    updateStorageCaps(
      maxFileCapMb * 1024 * 1024,
      userQuotaGb * 1024 * 1024 * 1024
    );
    toast.success('Storage guardrails updated successfully');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Storage Overview Meter */}
      <div className="card p-6 bg-white border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Cloud Storage Meter
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {organization.storagePlan || 'STARTER'} TIER
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Decoupled multi-tenant object storage with automated quota protection
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-bold text-slate-900 font-display">
                {formatBytes(orgStats.usedBytes)}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                / {formatBytes(orgStats.limitBytes)}
              </span>
              <div className="text-[11px] text-slate-500">{orgStats.percent}% consumed</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 space-y-2">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                orgStats.percent > 90
                  ? 'bg-red-500'
                  : orgStats.percent > 70
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.max(3, orgStats.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>Direct Uploads: {allDirectAttachments.length} files</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Zero-Footprint Links: {allCloudAttachments.length} links</span>
              </span>
            </div>
            <span>{formatBytes(Math.max(0, orgStats.limitBytes - orgStats.usedBytes))} free</span>
          </div>
        </div>
      </div>

      {/* Outcome-Based Pricing vs Seat-Based Pricing Strategy Card */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Outcome-Based Pricing Model</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Unlimited Team Seats • Transparent Storage Packs
            </h3>
            <p className="text-xs text-slate-300 max-w-xl mt-1">
              Generic PM tools (Jira, Asana, Monday) charge $15-$25 per user/month. We charge a flat fee for the organization with unlimited team members. Only add storage capacity as deliverables scale!
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl text-center shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Billing</span>
            <span className="text-sm font-bold text-emerald-400">Flat Organization Rate</span>
          </div>
        </div>

        {/* Pricing Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* STARTER */}
          <div
            onClick={() => handlePlanChange('STARTER')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedPlan === 'STARTER'
                ? 'bg-white/10 border-blue-400 ring-2 ring-blue-400/40 shadow-sm'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200">Starter Micro-SaaS</span>
              {selectedPlan === 'STARTER' && (
                <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-white mb-1">
              Free <span className="text-xs font-normal text-slate-400">/ forever</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">10 GB Object Storage • Unlimited Members</p>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li>✓ 25 MB max per file</li>
              <li>✓ 2 GB quota per user</li>
              <li>✓ Direct S3/R2 presigned upload</li>
            </ul>
          </div>

          {/* PRO */}
          <div
            onClick={() => handlePlanChange('PRO')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedPlan === 'PRO'
                ? 'bg-white/10 border-indigo-400 ring-2 ring-indigo-400/40 shadow-sm'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-300">Growth / Pro Pack</span>
              {selectedPlan === 'PRO' && (
                <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-white mb-1">
              $49 <span className="text-xs font-normal text-slate-400">/ mo flat</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">100 GB Cloud Storage • Unlimited Members</p>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li>✓ 50 MB max per file</li>
              <li>✓ 10 GB quota per user</li>
              <li>✓ Cloudflare R2 zero egress fees</li>
            </ul>
          </div>

          {/* ENTERPRISE */}
          <div
            onClick={() => handlePlanChange('ENTERPRISE')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedPlan === 'ENTERPRISE'
                ? 'bg-white/10 border-purple-400 ring-2 ring-purple-400/40 shadow-sm'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-300">Enterprise Dedicated</span>
              {selectedPlan === 'ENTERPRISE' && (
                <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-white mb-1">
              $199 <span className="text-xs font-normal text-slate-400">/ mo flat</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">1 TB Storage • Dedicated Bucket Partition</p>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li>✓ 250 MB max per file</li>
              <li>✓ Unlimited personal quotas</li>
              <li>✓ Custom S3/AWS IAM integration</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Storage Guardrails Configuration (Admin only) */}
      <div className="card p-6 bg-white border border-slate-200">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Tenant Storage Limits & Guardrails
              </h4>
              <p className="text-xs text-slate-500">
                Enforce hard bounds client-side and server-side to protect infrastructure
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={handleSaveGuardrails}
              className="btn-primary btn-sm py-1.5 px-3 text-xs"
            >
              Save Limits
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Per-File Cap */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Max Per-File Size Limit
              </label>
              <span className="text-xs font-mono font-bold text-blue-600">
                {maxFileCapMb} MB / file
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Uploads larger than this cap are rejected instantly before transferring network data.
            </p>
            <div className="flex items-center gap-2">
              {[10, 25, 50, 100].map((mb) => (
                <button
                  key={mb}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setMaxFileCapMb(mb)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    maxFileCapMb === mb
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {mb} MB
                </button>
              ))}
            </div>
          </div>

          {/* Per-User Quota */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Per-User Storage Quota
              </label>
              <span className="text-xs font-mono font-bold text-indigo-600">
                {userQuotaGb} GB / person
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Prevents a single rogue team member or runaway upload from exhausting organization capacity.
            </p>
            <div className="flex items-center gap-2">
              {[1, 2, 5, 10].map((gb) => (
                <button
                  key={gb}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setUserQuotaGb(gb)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    userQuotaGb === gb
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {gb} GB
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Member Storage Breakdown Table */}
      <div className="card overflow-hidden bg-white border border-slate-200">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Member Storage Breakdown ({users.length} members)
            </h4>
          </div>
          <span className="text-xs text-slate-500">
            Per-user limit: <strong className="text-slate-700">{formatBytes(orgStats.perUserLimitBytes)}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Direct Files</th>
                <th className="py-3 px-4">Storage Used</th>
                <th className="py-3 px-4">Quota Utilization</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberStorage.map(({ user: u, fileCount, usedBytes, pct }) => {
                const isWarning = pct >= 80;
                const isOver = pct >= 100;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} color={u.avatarColor} size="sm" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{fileCount} files</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {formatBytes(usedBytes)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 max-w-[160px]">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isOver ? (
                        <span className="badge-red text-[10px]">Quota Reached</span>
                      ) : isWarning ? (
                        <span className="badge-amber text-[10px]">High Usage</span>
                      ) : (
                        <span className="badge-green text-[10px]">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
