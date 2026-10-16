import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Clock, KeyRound, Lock, ScrollText, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useAdminSettingsStore, type SecuritySettings } from '../../../store/adminSettingsStore';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { FieldError, SectionFooter, SettingsCard, SettingRow, Toggle, useSectionDraft } from './sectionUi';

const RETENTION_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
];

const FIELD_LABELS: Record<string, string> = {
  sessionTimeoutMinutes: 'Session timeout',
  'loginPolicy.minPasswordLength': 'Minimum password length',
  'loginPolicy.maxFailedAttempts': 'Max failed login attempts',
  'loginPolicy.lockoutMinutes': 'Account lockout duration',
  'loginPolicy.requireMfaForAdmins': 'MFA required for admins',
  'loginPolicy.allowPasswordLogin': 'Password sign-in',
  'permissionPolicy.allowMemberProjectCreation': 'Members can create projects',
  'permissionPolicy.allowTlMemberManagement': 'Team Leaders can manage members',
  'permissionPolicy.restrictProfileEdits': 'Restrict profile edits',
  'permissionPolicy.allowExternalSharing': 'External sharing',
  auditRetentionDays: 'Audit retention',
};

const diffPaths = (before: SecuritySettings, after: SecuritySettings): string[] => {
  const out: string[] = [];
  const push = (path: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
  };
  push('sessionTimeoutMinutes', before.sessionTimeoutMinutes, after.sessionTimeoutMinutes);
  push('auditRetentionDays', before.auditRetentionDays, after.auditRetentionDays);
  (Object.keys(before.loginPolicy) as (keyof SecuritySettings['loginPolicy'])[]).forEach((k) =>
    push(`loginPolicy.${k}`, before.loginPolicy[k], after.loginPolicy[k])
  );
  (Object.keys(before.permissionPolicy) as (keyof SecuritySettings['permissionPolicy'])[]).forEach((k) =>
    push(`permissionPolicy.${k}`, before.permissionPolicy[k], after.permissionPolicy[k])
  );
  return out;
};

export const SecuritySection: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const { value, dirty, patch, cancel, save, reset } = useSectionDraft('security');

  const [errors, setErrors] = useState<{ session?: string; password?: string; attempts?: string; lockout?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<string>('');

  const setLogin = (patchInner: Partial<SecuritySettings['loginPolicy']>) =>
    patch({ loginPolicy: { ...value.loginPolicy, ...patchInner } });

  const setPermission = (patchInner: Partial<SecuritySettings['permissionPolicy']>) =>
    patch({ permissionPolicy: { ...value.permissionPolicy, ...patchInner } });

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (value.sessionTimeoutMinutes < 5 || value.sessionTimeoutMinutes > 1440)
      errs.session = 'Session timeout must be between 5 and 1440 minutes (24 hours).';
    if (value.loginPolicy.minPasswordLength < 8 || value.loginPolicy.minPasswordLength > 64)
      errs.password = 'Minimum password length must be between 8 and 64.';
    if (value.loginPolicy.maxFailedAttempts < 3 || value.loginPolicy.maxFailedAttempts > 10)
      errs.attempts = 'Failed attempts must be between 3 and 10.';
    if (value.loginPolicy.lockoutMinutes < 1 || value.loginPolicy.lockoutMinutes > 120)
      errs.lockout = 'Lockout duration must be between 1 and 120 minutes.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    return true;
  };

  const commit = () => {
    const before = useAdminSettingsStore.getState().settings.security;
    const next = save();
    const changed = diffPaths(before, next);

    if (changed.length > 0) {
      const permissionChanged = changed.some((p) => p.startsWith('permissionPolicy.'));
      appendAudit({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        section: 'security',
        category: 'SECURITY',
        action: 'Updated Security settings',
        summary: changed.map((p) => FIELD_LABELS[p] || p).join(', '),
      });
      if (permissionChanged) {
        appendAudit({
          adminId: currentUser?.id || 'admin',
          adminName: currentUser?.name || 'Administrator',
          section: 'security',
          category: 'PERMISSION',
          action: 'Changed Permission Policy',
          summary: changed
            .filter((p) => p.startsWith('permissionPolicy.'))
            .map((p) => FIELD_LABELS[p] || p)
            .join(', '),
        });
      }
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Security settings saved and enforced for this organization.');
    }, 250);
  };

  const handleSave = () => {
    if (!validate()) return;
    const before = useAdminSettingsStore.getState().settings.security;
    const changed = diffPaths(before, value);
    if (changed.length === 0) return;
    setPendingSummary(changed.map((p) => FIELD_LABELS[p] || p).join(', '));
    setConfirmOpen(true);
  };

  const sessionHours = (value.sessionTimeoutMinutes / 60).toFixed(value.sessionTimeoutMinutes % 60 === 0 ? 0 : 1);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Security and permission changes are sensitive — you will be asked to confirm before they are applied.
          Role capabilities themselves stay in <span className="font-semibold">Roles &amp; Permissions</span>; this page
          owns organization-wide guardrails.
        </p>
      </div>

      <SettingsCard
        title="Session Timeout"
        description="Sign users out after a period of inactivity."
        icon={<Clock className="w-4 h-4" />}
      >
        <SettingRow
          label="Idle session timeout"
          description="Minutes before an inactive session expires. Users must sign in again."
          htmlFor="sec-timeout"
        >
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="sec-timeout"
              type="number"
              min={5}
              max={1440}
              className={`input text-sm w-28 ${errors.session ? 'border-rose-400' : ''}`}
              value={value.sessionTimeoutMinutes}
              onChange={(e) => {
                patch({ sessionTimeoutMinutes: Math.floor(Number(e.target.value)) || 0 });
                setErrors((er) => ({ ...er, session: undefined }));
              }}
            />
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">minutes ({sessionHours}h)</span>
          </div>
          <FieldError>{errors.session}</FieldError>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Login Policy"
        description="Password rules and account lockout behaviour for non-SSO sign-ins."
        icon={<KeyRound className="w-4 h-4" />}
      >
        <SettingRow label="Minimum password length" htmlFor="sec-pwlen">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="sec-pwlen"
              type="number"
              min={8}
              max={64}
              className={`input text-sm w-24 ${errors.password ? 'border-rose-400' : ''}`}
              value={value.loginPolicy.minPasswordLength}
              onChange={(e) => {
                setLogin({ minPasswordLength: Math.floor(Number(e.target.value)) || 0 });
                setErrors((er) => ({ ...er, password: undefined }));
              }}
            />
            <span className="text-xs text-slate-500">chars</span>
          </div>
          <FieldError>{errors.password}</FieldError>
        </SettingRow>

        <SettingRow label="Max failed attempts" description="Consecutive failures before the account locks." htmlFor="sec-attempts">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="sec-attempts"
              type="number"
              min={3}
              max={10}
              className={`input text-sm w-24 ${errors.attempts ? 'border-rose-400' : ''}`}
              value={value.loginPolicy.maxFailedAttempts}
              onChange={(e) => {
                setLogin({ maxFailedAttempts: Math.floor(Number(e.target.value)) || 0 });
                setErrors((er) => ({ ...er, attempts: undefined }));
              }}
            />
            <span className="text-xs text-slate-500">times</span>
          </div>
          <FieldError>{errors.attempts}</FieldError>
        </SettingRow>

        <SettingRow label="Account lockout duration" htmlFor="sec-lockout">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="sec-lockout"
              type="number"
              min={1}
              max={120}
              className={`input text-sm w-24 ${errors.lockout ? 'border-rose-400' : ''}`}
              value={value.loginPolicy.lockoutMinutes}
              onChange={(e) => {
                setLogin({ lockoutMinutes: Math.floor(Number(e.target.value)) || 0 });
                setErrors((er) => ({ ...er, lockout: undefined }));
              }}
            />
            <span className="text-xs text-slate-500">minutes</span>
          </div>
          <FieldError>{errors.lockout}</FieldError>
        </SettingRow>

        <SettingRow
          label="Require MFA for administrators"
          description="Admins must complete a second verification factor at sign-in."
        >
          <Toggle
            checked={value.loginPolicy.requireMfaForAdmins}
            onChange={(next) => setLogin({ requireMfaForAdmins: next })}
          />
        </SettingRow>

        <SettingRow
          label="Allow password sign-in"
          description="Fallback password login alongside enterprise SSO. SSO enforcement lives in Settings → Enterprise SSO and Microsoft Entra sign-in is unchanged."
        >
          <Toggle
            checked={value.loginPolicy.allowPasswordLogin}
            onChange={(next) => setLogin({ allowPasswordLogin: next })}
          />
        </SettingRow>

        {!value.loginPolicy.allowPasswordLogin && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 leading-relaxed">
              Password sign-in is disabled. Users without a configured SSO provider will not be able to sign in.
            </p>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Permission Policy"
        description="Organization-wide guardrails layered on top of the role matrix."
        icon={<ShieldCheck className="w-4 h-4" />}
      >
        <SettingRow
          label="Allow members to create projects"
          description="When off, only Admins and Project Managers can create projects."
        >
          <Toggle
            checked={value.permissionPolicy.allowMemberProjectCreation}
            onChange={(next) => setPermission({ allowMemberProjectCreation: next })}
          />
        </SettingRow>

        <SettingRow
          label="Allow Team Leaders to manage project members"
          description="Team Leaders can add/remove members on projects they lead."
        >
          <Toggle
            checked={value.permissionPolicy.allowTlMemberManagement}
            onChange={(next) => setPermission({ allowTlMemberManagement: next })}
          />
        </SettingRow>

        <SettingRow
          label="Restrict profile edits"
          description="Only Admins can change user profile details."
        >
          <Toggle
            checked={value.permissionPolicy.restrictProfileEdits}
            onChange={(next) => setPermission({ restrictProfileEdits: next })}
          />
        </SettingRow>

        <SettingRow
          label="Allow external sharing"
          description="Permit share links to people outside the organization."
        >
          <Toggle
            checked={value.permissionPolicy.allowExternalSharing}
            onChange={(next) => setPermission({ allowExternalSharing: next })}
          />
        </SettingRow>

        {value.permissionPolicy.allowMemberProjectCreation && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Any member of the organization will be able to create projects.
            </p>
          </div>
        )}
        {value.permissionPolicy.allowExternalSharing && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              External share links bypass organization boundaries — enable only when required.
            </p>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Audit Retention"
        description="How long audit records are kept before automatic cleanup."
        icon={<ScrollText className="w-4 h-4" />}
      >
        <SettingRow label="Retention period" description="Applies to user activity, permission and project change logs." htmlFor="sec-retention">
          <div className="w-full sm:w-56">
            <select
              id="sec-retention"
              className="select text-sm"
              value={value.auditRetentionDays}
              onChange={(e) => patch({ auditRetentionDays: Number(e.target.value) })}
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </SettingRow>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Lock className="w-3 h-3" /> Audit records are stored in this browser for the frontend-only build.
        </div>
      </SettingsCard>

      <SectionFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => {
          cancel();
          setErrors({});
        }}
        onReset={() => setResetOpen(true)}
        saveLabel="Save Security Changes"
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          commit();
        }}
        title="Apply security changes?"
        message={`The following will be applied organization-wide: ${pendingSummary}. These settings affect sign-in and permissions for every user.`}
        confirmLabel="Apply Changes"
      />

      <ConfirmDialog
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          reset();
          setErrors({});
          setResetOpen(false);
          toast.success('Security settings reset to defaults.');
        }}
        title="Reset security settings to default?"
        message="Session timeout, login policy, permission policy and audit retention will return to factory defaults."
        confirmLabel="Reset Security"
        danger
      />
    </div>
  );
};
