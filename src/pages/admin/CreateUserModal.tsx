import React, { useState } from 'react';
import { X, User, Mail, Briefcase, Hash, Users } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { Role } from '../../types';
import { getRoleLabel } from '../../utils/roleUtils';
import { toast } from 'sonner';

interface CreateUserModalProps {
  onClose: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ onClose }) => {
  const { createUser, teams } = useAppStore();
  const { currentUser } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    role: 'MEMBER' as Role,
    teamId: '',
    jobTitle: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    createUser({
      organizationId: currentUser?.organizationId || 'org-001',
      name: form.name,
      email: form.email,
      employeeId: form.employeeId,
      role: form.role,
      teamId: form.teamId || undefined,
      jobTitle: form.jobTitle || undefined,
    });

    toast.success(`Invitation sent to ${form.email}`);
    setLoading(false);
    onClose();
  };

  const roles: Role[] = ['PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-modal animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add New User</h2>
            <p className="text-sm text-slate-500 mt-0.5">An invitation will be sent to their email</p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="input-label" htmlFor="u-name">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="u-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Rahul Kumar"
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="input-label" htmlFor="u-email">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="rahul@company.com"
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Employee ID */}
          <div>
            <label className="input-label" htmlFor="u-emp">Employee ID</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="u-emp"
                type="text"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                placeholder="EMP1024"
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="input-label" htmlFor="u-role">Role</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="u-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="select pl-9"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{getRoleLabel(r)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Job Title */}
          <div>
            <label className="input-label" htmlFor="u-title">Job Title <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              id="u-title"
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="Senior Software Engineer"
              className="input"
            />
          </div>

          {/* Team (optional) */}
          <div>
            <label className="input-label" htmlFor="u-team">
              <Users className="inline w-3.5 h-3.5 mr-1" />
              Team <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              id="u-team"
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              className="select"
            >
              <option value="">No team assigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* No password note */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">No password required.</span> The user will receive an invitation email to set their own password and activate their account.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Create & Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
