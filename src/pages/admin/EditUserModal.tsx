import React, { useState } from 'react';
import { X, User, Mail, Briefcase, Hash, Save, Users } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { Role, User as UserType } from '../../types';
import { getRoleLabel, canManageUser } from '../../utils/roleUtils';
import { toast } from 'sonner';

interface EditUserModalProps {
  user: UserType;
  onClose: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose }) => {
  const { updateUser, teams } = useAppStore();
  const { currentUser } = useAuthStore();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    employeeId: user.employeeId,
    role: user.role,
    jobTitle: user.jobTitle || '',
    teamId: user.teamId || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enforce the user-management hierarchy on submit as well as in the UI.
    if (!assignableRoles.includes(form.role as Role)) {
      toast.error('You are not allowed to assign that role');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    updateUser(user.id, {
      name: form.name,
      email: form.email,
      employeeId: form.employeeId,
      role: form.role as Role,
      jobTitle: form.jobTitle || undefined,
      teamId: form.teamId || undefined,
    });

    toast.success(`${form.name}'s details updated`);
    setLoading(false);
    onClose();
  };

  const roles: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER'];

  // Roles this actor may assign to this user (hierarchy: Admin → all,
  // PM → Team Leaders & Members, TL → Members only).
  const assignableRoles = roles.filter((r) => canManageUser(currentUser?.role, r));
  const roleLocked = assignableRoles.length <= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-modal animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit User</h2>
            <p className="text-sm text-slate-500 mt-0.5">Update {user.name}'s account details</p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="input-label" htmlFor="eu-name">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="eu-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="input-label" htmlFor="eu-email">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="eu-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Employee ID */}
          <div>
            <label className="input-label" htmlFor="eu-emp">Employee ID</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="eu-emp"
                type="text"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="input-label" htmlFor="eu-role">Role</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="eu-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="select pl-9"
                disabled={roleLocked}
                title={roleLocked ? 'Your role cannot change this user\'s role' : undefined}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{getRoleLabel(r)}</option>
                ))}
              </select>
            </div>
            {roleLocked && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Restricted by your role — you can manage this user's details only.
              </p>
            )}
          </div>

          {/* Job Title */}
          <div>
            <label className="input-label" htmlFor="eu-title">Job Title <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              id="eu-title"
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="input"
            />
          </div>

          {/* Team */}
          <div>
            <label className="input-label" htmlFor="eu-team">Team <span className="text-slate-400 font-normal">(optional)</span></label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="eu-team"
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                className="select pl-9"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
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
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
