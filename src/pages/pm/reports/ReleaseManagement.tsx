import React, { useState } from 'react';
import { Package, Plus, Calendar, CheckCircle2, Clock, X, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useAuthStore } from '../../../store/authStore';
import { ProgressBar } from '../../../components/common/ProgressBar';
import { formatDate } from '../../../utils/dateUtils';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import { toast } from 'sonner';
import type { ReleaseStatus } from '../../../types';

interface ReleaseManagementProps {
  projectId: string;
}

const STATUS_COLORS: Record<ReleaseStatus, { bg: string; text: string; border: string }> = {
  PLANNING: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  RELEASED: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

export const ReleaseManagement: React.FC<ReleaseManagementProps> = ({ projectId }) => {
  const { releases, tasks, createRelease, updateRelease, deleteRelease } = useAppStore();
  const { currentUser } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', version: '', description: '', startDate: '', targetDate: '' });

  const projectReleases = releases
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.version.trim()) return;

    createRelease({
      projectId,
      name: form.name,
      version: form.version,
      description: form.description,
      startDate: form.startDate,
      targetDate: form.targetDate,
      status: 'PLANNING',
      taskIds: [],
      epicIds: [],
      createdById: currentUser?.id || '',
    });
    toast.success(`Release "${form.name}" created`);
    setForm({ name: '', version: '', description: '', startDate: '', targetDate: '' });
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0d9488]" />
            Delivery Releases
          </h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">Manage delivery versions and readiness tracking</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> New Release
        </button>
      </div>

      {/* Release Cards */}
      {projectReleases.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0d9488]/10 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-[#0d9488]" />
          </div>
          <h3 className="text-sm font-bold text-[#1a1d23]">No Releases Yet</h3>
          <p className="text-xs text-[#9ca3af] mt-1">Create your first release to track delivery versions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectReleases.map((release) => {
            // Cancelled work leaves the release ratio: never done, never remaining.
            const releaseTasks = tasks.filter((t) => release.taskIds.includes(t.id) && !isCancelledWorkItem(t));
            const doneTasks = releaseTasks.filter((t) => t.status === 'DONE').length;
            const progressPct = releaseTasks.length > 0 ? Math.round((doneTasks / releaseTasks.length) * 100) : 0;
            const statusStyle = STATUS_COLORS[release.status];
            const isReady = progressPct >= 100 && release.status !== 'CANCELLED';
            const isNearReady = progressPct >= 80 && progressPct < 100;

            return (
              <div key={release.id} className="card p-5 hover:shadow-md transition-all relative overflow-hidden">
                {/* Readiness Indicator */}
                {isReady && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-[#10b981] border-l-[40px] border-l-transparent" />
                )}
                {isNearReady && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-[#f59e0b] border-l-[40px] border-l-transparent" />
                )}

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-[#1a1d23]">{release.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                        {release.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-[#9ca3af]">v{release.version}</div>
                    {release.description && (
                      <p className="text-xs text-[#6b7280] mt-1 line-clamp-2">{release.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#1a1d23]">{progressPct}%</div>
                    <div className="text-[10px] text-[#9ca3af]">{doneTasks}/{releaseTasks.length} done</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f1f3f4]">
                  <button
                    className="btn-secondary btn-sm text-[10px] flex-1"
                    onClick={() => {
                      const nextStatus: Record<ReleaseStatus, ReleaseStatus> = {
                        PLANNING: 'IN_PROGRESS',
                        IN_PROGRESS: 'RELEASED',
                        RELEASED: 'RELEASED',
                        CANCELLED: 'CANCELLED',
                      };
                      updateRelease(release.id, { status: nextStatus[release.status] });
                      toast.success(`Release status updated to ${nextStatus[release.status].replace(/_/g, ' ')}`);
                    }}
                    disabled={release.status === 'RELEASED' || release.status === 'CANCELLED'}
                  >
                    <Clock className="w-3 h-3" />
                    {release.status === 'PLANNING' ? 'Start Release' :
                     release.status === 'IN_PROGRESS' ? 'Mark Released' : 'Released'}
                  </button>
                  <button
                    className="btn-secondary btn-sm text-[10px] text-[#ef4444] hover:bg-[#fef2f2]"
                    onClick={() => {
                      deleteRelease(release.id);
                      toast.success('Release deleted');
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-[#f1f3f4] rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: isReady ? '#10b981' : isNearReady ? '#f59e0b' : '#0d9488',
                    }}
                  />
                </div>

                {/* Readiness Badge */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg font-bold ${
                      isReady ? 'bg-[#10b981]/10 text-[#10b981]' :
                      isNearReady ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                      'bg-[#9ca3af]/10 text-[#9ca3af]'
                    }`}>
                      {isReady ? 'READY FOR DELIVERY' : isNearReady ? 'NEAR READY' : 'IN PROGRESS'}
                    </span>
                  </div>
                  <span className="text-[#9ca3af]">
                    {release.startDate && `Start: ${formatDate(release.startDate)}`}
                    {release.targetDate && ` · Target: ${formatDate(release.targetDate)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Release Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-modal animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Create Release</h2>
              <button className="btn-ghost p-2" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="input-label">Release Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="v1.0 MVP"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="input-label">Version</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0.0"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="input-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Release description..."
                  className="input resize-none h-16"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Target Date</label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center">
                  Create Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
