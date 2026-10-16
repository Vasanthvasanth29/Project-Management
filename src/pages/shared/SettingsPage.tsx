import React, { useState, useEffect } from 'react';
import { User, Shield, Key, Save, Lock, Edit3, X, Eye, EyeOff, ShieldCheck, KeyRound, Globe, CheckCircle2, Sparkles, HardDrive } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { useSSOStore } from '../../store/ssoStore';
import { useOrganizationBranding } from '../../store/adminSettingsStore';
import { RoleBadge } from '../../components/common/Badges';
import { Avatar } from '../../components/common/Avatar';
import { SSOSettingsTab } from './settings/SSOSettingsTab';
import { StorageSettingsTab } from './settings/StorageSettingsTab';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const { currentUser, updateCurrentUser } = useAuthStore();
  const { updateUser } = useAppStore();
  const branding = useOrganizationBranding();

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [form, setForm] = useState({
    name: currentUser.name,
    email: currentUser.email,
    employeeId: currentUser.employeeId,
    jobTitle: currentUser.jobTitle || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: currentUser.name,
      email: currentUser.email,
      employeeId: currentUser.employeeId,
      jobTitle: currentUser.jobTitle || '',
    });
  }, [currentUser]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setTimeout(() => {
      const updates = {
        name: form.name,
        email: form.email,
        employeeId: form.employeeId,
        jobTitle: form.jobTitle,
      };

      updateCurrentUser(updates);
      updateUser(currentUser.id, updates);

      setIsSaving(false);
      setIsEditing(false);
      toast.success('Admin profile updated successfully!');
    }, 400);
  };

  const handleCancelEdit = () => {
    setForm({
      name: currentUser.name,
      email: currentUser.email,
      employeeId: currentUser.employeeId,
      jobTitle: currentUser.jobTitle || '',
    });
    setIsEditing(false);
  };

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SSO' | 'CONNECTED' | 'STORAGE'>('PROFILE');
  const authProvider = currentUser.authProvider || 'PASSWORD';

  const handleLinkProvider = (provider: 'GOOGLE' | 'MICROSOFT' | 'OKTA') => {
    updateCurrentUser({ authProvider: provider });
    updateUser(currentUser.id, { authProvider: provider });
    toast.success(`Identity linked to ${provider} SSO successfully!`);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Account & Security Settings</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Manage administrator profile, enterprise SSO federation, and authentication policies'
              : 'View your profile details, linked corporate identities, and security settings'}
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'PROFILE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profile
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SSO')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'SSO'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Enterprise SSO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONNECTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'CONNECTED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            <span>Connected Auth</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STORAGE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'STORAGE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>Storage & Quotas</span>
          </button>
        </div>
      </div>
      {/* TAB 1: PROFILE */}
      {activeTab === 'PROFILE' && (
        <div className="card p-6 space-y-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100 flex-wrap justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size="xl" />
              <div>
                <h2 className="text-xl font-bold text-slate-900">{currentUser.name}</h2>
                <p className="text-xs text-slate-500">
                  {currentUser.email} · {currentUser.employeeId}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <RoleBadge role={currentUser.role} />
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
                    Auth: {authProvider}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin ? (
              !isEditing ? (
                <button
                  type="button"
                  className="btn-primary btn-sm shadow-sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={handleCancelEdit}
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              )
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Handled by System Admin</span>
              </div>
            )}
          </div>

          {/* Non-Admin Notice */}
          {!isAdmin && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>Profile information is handled by the System Administrator.</span>
            </div>
          )}

          {/* Profile Details Form */}
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
                Profile Details
              </h3>
              {isAdmin && isEditing && (
                <span className="text-xs text-brand-600 font-semibold flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Editing Mode Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  readOnly={!isAdmin || !isEditing}
                  className={`input ${!isAdmin || !isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  required
                />
              </div>

              <div>
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  readOnly={!isAdmin || !isEditing}
                  className={`input ${!isAdmin || !isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  required
                />
              </div>

              <div>
                <label className="input-label">Employee ID</label>
                <input
                  type="text"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  readOnly={!isAdmin || !isEditing}
                  className={`input ${!isAdmin || !isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  required
                />
              </div>

              <div>
                <label className="input-label">Job Title</label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  readOnly={!isAdmin || !isEditing}
                  placeholder="e.g. System Administrator"
                  className={`input ${!isAdmin || !isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {isAdmin && isEditing && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary shadow-sm"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
              Security
            </h3>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setShowPasswordModal(true)}
            >
              <Key className="w-4 h-4 text-brand-600" /> Change Password
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ENTERPRISE SSO CONFIG */}
      {activeTab === 'SSO' && <SSOSettingsTab />}

      {/* TAB 3: CONNECTED IDENTITIES */}
      {activeTab === 'CONNECTED' && (
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Connected Single Sign-On (SSO) Accounts
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Link your corporate identity providers to sign in with 1-click using Google SSO, Microsoft Entra ID, or Okta SAML.
            </p>
          </div>

          <div className="space-y-3">
            {/* Google */}
            <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Google SSO</div>
                  <div className="text-[11px] text-slate-500">
                    {authProvider === 'GOOGLE'
                      ? `Connected via OIDC (${currentUser.email})`
                      : 'Not currently set as primary sign-in provider'}
                  </div>
                </div>
              </div>

              {authProvider === 'GOOGLE' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Primary SSO
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLinkProvider('GOOGLE')}
                  className="btn-secondary btn-sm"
                >
                  Link Google SSO
                </button>
              )}
            </div>

            {/* Microsoft */}
            <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0078d4]/10 border border-[#0078d4]/20 flex items-center justify-center flex-shrink-0">
                  <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                    <span className="bg-[#f25022] rounded-[0.5px]" />
                    <span className="bg-[#7fba00] rounded-[0.5px]" />
                    <span className="bg-[#00a4ef] rounded-[0.5px]" />
                    <span className="bg-[#ffb900] rounded-[0.5px]" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Microsoft Entra ID (Azure AD)</div>
                  <div className="text-[11px] text-slate-500">
                    {authProvider === 'MICROSOFT'
                      ? `Connected via Microsoft 365 Tenant (${currentUser.email})`
                      : 'Sign in using corporate Microsoft 365 account'}
                  </div>
                </div>
              </div>

              {authProvider === 'MICROSOFT' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Primary SSO
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLinkProvider('MICROSOFT')}
                  className="btn-secondary btn-sm"
                >
                  Link Microsoft SSO
                </button>
              )}
            </div>

            {/* Okta SAML */}
            <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00297a]/10 border border-[#00297a]/20 flex items-center justify-center flex-shrink-0 text-[#00297a]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Okta Enterprise SAML 2.0</div>
                  <div className="text-[11px] text-slate-500">
                    {authProvider === 'OKTA' || authProvider === 'SAML'
                      ? `Federated with ${branding.name} Identity Provider`
                      : 'Corporate assertion via SAML 2.0'}
                  </div>
                </div>
              </div>

              {authProvider === 'OKTA' || authProvider === 'SAML' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Primary SSO
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLinkProvider('OKTA')}
                  className="btn-secondary btn-sm"
                >
                  Link Okta SSO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STORAGE & QUOTAS */}
      {activeTab === 'STORAGE' && (
        <StorageSettingsTab />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
};

/* ---------- Change Password Modal ---------- */

const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (!newPassword) errs.newPassword = 'New password is required';
    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(newPassword)) errs.newPassword = 'Must include an uppercase letter';
    else if (!/[a-z]/.test(newPassword)) errs.newPassword = 'Must include a lowercase letter';
    else if (!/[0-9]/.test(newPassword)) errs.newPassword = 'Must include a number';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (currentPassword && newPassword && currentPassword === newPassword) errs.newPassword = 'New password must differ from current';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    toast.success('Password updated successfully');
    onClose();
  };

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '#e0e2ec', width: '0%' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', color: '#ea4335', width: '33%' };
    if (score <= 3) return { label: 'Fair', color: '#fbbc04', width: '66%' };
    return { label: 'Strong', color: '#34a853', width: '100%' };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-modal animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
            <p className="text-sm text-slate-500 mt-0.5">Update your account password</p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="input-label" htmlFor="cp-current">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="cp-current"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`input pl-9 pr-10 ${errors.currentPassword ? 'border-red-400' : ''}`}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword}</p>}
          </div>

          {/* New Password */}
          <div>
            <label className="input-label" htmlFor="cp-new">New Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="cp-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`input pl-9 pr-10 ${errors.newPassword ? 'border-red-400' : ''}`}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>}
            {/* Strength indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: strength.width, backgroundColor: strength.color }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="input-label" htmlFor="cp-confirm">Confirm New Password</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="cp-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input pl-9 pr-10 ${errors.confirmPassword ? 'border-red-400' : ''}`}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
          </div>

          {/* Security note */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Security tip:</span> Use a strong password with at least 8 characters, including uppercase, lowercase, and numbers.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


