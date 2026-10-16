import React, { useState } from 'react';
import { toast } from 'sonner';
import { AtSign, Bell, CalendarClock, Mail, UserCheck } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useAdminSettingsStore, type NotificationSettings } from '../../../store/adminSettingsStore';
import { FieldError, SectionFooter, SettingsCard, SettingRow, Toggle, useSectionDraft } from './sectionUi';

const LEAD_DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
const ESCALATION_OPTIONS = [1, 2, 3, 5, 7];

export const NotificationsSection: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const { value, dirty, patch, cancel, save, reset } = useSectionDraft('notifications');

  const [errors, setErrors] = useState<{ lead?: string; escalation?: string }>({});
  const [saving, setSaving] = useState(false);

  const setField = (updates: Partial<NotificationSettings>) => patch(updates);

  const handleSave = () => {
    const errs: typeof errors = {};
    if (value.dueDateReminders && (value.dueDateLeadDays < 0 || value.dueDateLeadDays > 14))
      errs.lead = 'Lead time must be between 0 and 14 days.';
    if (value.overdueAlerts && (value.overdueEscalationDays < 1 || value.overdueEscalationDays > 30))
      errs.escalation = 'Escalation must be between 1 and 30 days.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    const next = save();
    const active: string[] = [];
    if (next.emailEnabled) active.push(`email (${next.emailDigest.toLowerCase()})`);
    if (next.inAppEnabled) active.push('in-app');
    if (next.notifyOnAssignment) active.push('assignment');
    if (next.dueDateReminders) active.push(`due-date (${next.dueDateLeadDays}d)`);
    if (next.overdueAlerts) active.push(`overdue (${next.overdueEscalationDays}d)`);

    appendAudit({
      adminId: currentUser?.id || 'admin',
      adminName: currentUser?.name || 'Administrator',
      section: 'notifications',
      category: 'SETTINGS',
      action: 'Updated Notification settings',
      summary: `Active channels: ${active.length > 0 ? active.join(', ') : 'none'}`,
    });
    setTimeout(() => {
      setSaving(false);
      toast.success('Notification preferences saved.');
    }, 200);
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Email Notifications"
        description="Control whether FlowExec sends email at all, and how often it batches it."
        icon={<Mail className="w-4 h-4" />}
      >
        <SettingRow label="Email notifications" description="Master switch for all outbound email.">
          <Toggle checked={value.emailEnabled} onChange={(next) => setField({ emailEnabled: next })} />
        </SettingRow>

        <SettingRow
          label="Email digest"
          description="How frequently notification emails are delivered."
          htmlFor="nt-digest"
        >
          <div className="w-full sm:w-56">
            <select
              id="nt-digest"
              className="select text-sm"
              value={value.emailDigest}
              disabled={!value.emailEnabled}
              onChange={(e) => setField({ emailDigest: e.target.value as NotificationSettings['emailDigest'] })}
            >
              <option value="INSTANT">Instant — as it happens</option>
              <option value="DAILY">Daily digest</option>
              <option value="WEEKLY">Weekly digest</option>
            </select>
          </div>
        </SettingRow>

        {!value.emailEnabled && (
          <p className="text-[11px] text-slate-400">Email delivery is off — users rely on in-app notifications only.</p>
        )}
      </SettingsCard>

      <SettingsCard
        title="In-App Notifications"
        description="Notifications inside FlowExec (bell menu and notifications page)."
        icon={<Bell className="w-4 h-4" />}
      >
        <SettingRow label="In-app notifications" description="Master switch for the in-app notification feed.">
          <Toggle checked={value.inAppEnabled} onChange={(next) => setField({ inAppEnabled: next })} />
        </SettingRow>

        <SettingRow
          label="Show message previews"
          description="Display the notification message body instead of a generic title."
        >
          <Toggle
            checked={value.inAppShowPreviews}
            disabled={!value.inAppEnabled}
            onChange={(next) => setField({ inAppShowPreviews: next })}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Assignment Notifications"
        description="Alerts when work is assigned to or removed from a person."
        icon={<UserCheck className="w-4 h-4" />}
      >
        <SettingRow label="Notify on assignment" description="Notify the assignee whenever an item is assigned to them.">
          <Toggle checked={value.notifyOnAssignment} onChange={(next) => setField({ notifyOnAssignment: next })} />
        </SettingRow>

        <SettingRow
          label="Also send by email"
          description="Copy assignment alerts to the assignee's inbox."
        >
          <Toggle
            checked={value.assignmentEmailCopy}
            disabled={!value.notifyOnAssignment || !value.emailEnabled}
            onChange={(next) => setField({ assignmentEmailCopy: next })}
          />
        </SettingRow>

        {!value.emailEnabled && value.assignmentEmailCopy && (
          <p className="text-[11px] text-slate-400">Email copy is inactive while email notifications are off.</p>
        )}
      </SettingsCard>

      <SettingsCard
        title="Due Date & Overdue Notifications"
        description="Reminders ahead of due dates and escalation once work is overdue."
        icon={<CalendarClock className="w-4 h-4" />}
      >
        <SettingRow label="Due date reminders" description="Remind assignees before an item is due.">
          <Toggle checked={value.dueDateReminders} onChange={(next) => setField({ dueDateReminders: next })} />
        </SettingRow>

        <SettingRow label="Remind ahead of time" description="Days before the due date to send the reminder." htmlFor="nt-lead">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="nt-lead"
              className={`select text-sm w-32 ${errors.lead ? 'border-rose-400' : ''}`}
              value={value.dueDateLeadDays}
              disabled={!value.dueDateReminders}
              onChange={(e) => {
                setField({ dueDateLeadDays: Number(e.target.value) });
                setErrors((er) => ({ ...er, lead: undefined }));
              }}
            >
              {LEAD_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'On due date' : `${d} day${d === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">before due</span>
          </div>
          <FieldError>{errors.lead}</FieldError>
        </SettingRow>

        <SettingRow label="Overdue alerts" description="Flag overdue work to assignees and project managers.">
          <Toggle checked={value.overdueAlerts} onChange={(next) => setField({ overdueAlerts: next })} />
        </SettingRow>

        <SettingRow label="Escalate after" description="Days past due before the item is escalated." htmlFor="nt-esc">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="nt-esc"
              className={`select text-sm w-32 ${errors.escalation ? 'border-rose-400' : ''}`}
              value={value.overdueEscalationDays}
              disabled={!value.overdueAlerts}
              onChange={(e) => {
                setField({ overdueEscalationDays: Number(e.target.value) });
                setErrors((er) => ({ ...er, escalation: undefined }));
              }}
            >
              {ESCALATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} day{d === 1 ? '' : 's'}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">past due</span>
          </div>
          <FieldError>{errors.escalation}</FieldError>
        </SettingRow>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
          <AtSign className="w-3 h-3" /> Preferences apply to every role — personal overrides stay in the user settings.
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
        onReset={() => {
          reset();
          setErrors({});
          toast.success('Notification settings reset to defaults.');
        }}
      />
    </div>
  );
};
