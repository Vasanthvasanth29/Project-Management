import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Clock, Globe, Layers, Trash2, Upload } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useAppStore } from '../../../store/appStore';
import {
  TIME_ZONE_OPTIONS,
  WORKING_DAY_OPTIONS,
  useAdminSettingsStore,
  type GeneralSettings,
} from '../../../store/adminSettingsStore';
import { FieldError, SectionFooter, SettingsCard, SettingRow, useSectionDraft } from './sectionUi';

const LOGO_MAX_BYTES = 500 * 1024;

const FIELD_LABELS: Record<keyof GeneralSettings, string> = {
  organizationName: 'Organization Name',
  logoUrl: 'Organization Logo',
  timeZone: 'Time Zone',
  workingDays: 'Working Days',
  workingHoursStart: 'Working Hours',
  workingHoursEnd: 'Working Hours',
};

export const GeneralSection: React.FC = () => {
  const { currentUser, updateCurrentUser } = useAuthStore();
  const updateOrganization = useAppStore((s) => s.updateOrganization);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const { value, dirty, patch, cancel, save, reset } = useSectionDraft('general');

  const [errors, setErrors] = useState<Partial<Record<keyof GeneralSettings, string>>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timeZoneOptions = useMemo(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && !TIME_ZONE_OPTIONS.includes(detected)) return [detected, ...TIME_ZONE_OPTIONS];
    } catch {
      /* ignore */
    }
    return TIME_ZONE_OPTIONS;
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof GeneralSettings, string>> = {};
    const name = value.organizationName.trim();
    if (!name) errs.organizationName = 'Organization name is required.';
    else if (name.length < 2) errs.organizationName = 'Organization name must be at least 2 characters.';
    else if (name.length > 60) errs.organizationName = 'Organization name must be 60 characters or fewer.';

    const logo = value.logoUrl.trim();
    if (logo && !logo.startsWith('data:image/') && !/^https?:\/\/\S+$/i.test(logo)) {
      errs.logoUrl = 'Logo must be an uploaded image or a valid http(s) URL.';
    }

    if (value.workingDays.length === 0) errs.workingDays = 'Select at least one working day.';

    if (!value.workingHoursStart || !value.workingHoursEnd) {
      errs.workingHoursEnd = 'Both working hour times are required.';
    } else if (value.workingHoursStart === value.workingHoursEnd) {
      errs.workingHoursEnd = 'Start and end time cannot be the same.';
    } else if (value.workingHoursEnd < value.workingHoursStart) {
      errs.workingHoursEnd = 'End time must be after the start time.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, SVG, JPG or WebP).');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Logo file is too large. Maximum size is 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ logoUrl: String(reader.result || '') });
      setErrors((e) => ({ ...e, logoUrl: undefined }));
      toast.success('Logo ready — save changes to apply it.');
    };
    reader.onerror = () => toast.error('Could not read the selected file.');
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!validate()) return;
    setSaving(true);

    const before = useAdminSettingsStore.getState().settings.general;
    const next = save();

    const changedKeys = (Object.keys(next) as (keyof GeneralSettings)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(next[k])
    );
    const changedFields = Array.from(new Set(changedKeys.map((k) => FIELD_LABELS[k])));

    // Propagate branding to the runtime stores so every existing reader
    // (profile, storage, uploads) reflects the new organization identity.
    if (currentUser) {
      updateCurrentUser({
        organization: {
          ...currentUser.organization,
          name: next.organizationName.trim(),
          logoUrl: next.logoUrl.trim() || undefined,
        },
      });
    }
    updateOrganization({
      name: next.organizationName.trim(),
      logoUrl: next.logoUrl.trim() || undefined,
    });

    if (changedFields.length > 0) {
      appendAudit({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        section: 'general',
        category: 'SETTINGS',
        action: 'Updated General settings',
        summary: `Changed ${changedFields.join(', ')}`,
      });
    }

    setTimeout(() => {
      setSaving(false);
      toast.success(
        changedFields.length > 0
          ? `General settings saved — "${next.organizationName.trim()}" branding updated across FlowExec.`
          : 'General settings saved.'
      );
    }, 250);
  };

  const handleReset = () => {
    reset();
    setErrors({});
    toast.success('General settings reset to defaults.');
  };

  const toggleDay = (day: string) => {
    const days = value.workingDays.includes(day)
      ? value.workingDays.filter((d) => d !== day)
      : [...value.workingDays, day];
    patch({ workingDays: days });
    setErrors((e) => ({ ...e, workingDays: undefined }));
  };

  const brandPreview = value.logoUrl ? (
    <img
      src={value.logoUrl}
      alt="Organization logo"
      className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-white shadow-sm"
    />
  ) : (
    <div
      className="w-14 h-14 rounded-xl flex items-center justify-center border border-slate-200 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}
    >
      <Layers className="w-6 h-6 text-white" />
    </div>
  );

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Organization Identity"
        description="The organization name and logo are used across the sidebar, top bar and admin surfaces."
        icon={<Building2 className="w-4 h-4" />}
      >
        <div className="space-y-1">
          <SettingRow
            label="Organization Name"
            description="Shown in navigation, dashboards and exports."
            htmlFor="org-name"
          >
            <div className="w-full sm:w-80">
              <input
                id="org-name"
                type="text"
                className={`input text-sm ${errors.organizationName ? 'border-rose-400 focus:ring-rose-500' : ''}`}
                value={value.organizationName}
                maxLength={60}
                placeholder="e.g. Invictus Tec"
                onChange={(e) => {
                  patch({ organizationName: e.target.value });
                  setErrors((er) => ({ ...er, organizationName: undefined }));
                }}
              />
              <FieldError>{errors.organizationName}</FieldError>
            </div>
          </SettingRow>

          <SettingRow
            label="Organization Logo"
            description="PNG, SVG, JPG or WebP up to 500 KB. Applied to the sidebar and top bar brand."
            stacked
          >
            <div className="flex items-center gap-4 flex-wrap">
              {brandPreview}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoFile(file);
                    e.target.value = '';
                  }}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 text-[#0d9488]" /> Upload Image
                </button>
                {value.logoUrl && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-500 hover:text-rose-600"
                    onClick={() => {
                      patch({ logoUrl: '' });
                      setErrors((e) => ({ ...e, logoUrl: undefined }));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="w-full sm:w-80">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  Or paste an image URL
                </label>
                <input
                  type="url"
                  className={`input text-xs ${errors.logoUrl ? 'border-rose-400 focus:ring-rose-500' : ''}`}
                  value={value.logoUrl.startsWith('data:') ? '' : value.logoUrl}
                  placeholder="https://example.com/logo.png"
                  disabled={value.logoUrl.startsWith('data:')}
                  onChange={(e) => {
                    patch({ logoUrl: e.target.value });
                    setErrors((er) => ({ ...er, logoUrl: undefined }));
                  }}
                />
                <FieldError>{errors.logoUrl}</FieldError>
                {value.logoUrl.startsWith('data:') && (
                  <p className="text-[10px] text-slate-400 mt-1">Uploaded image in use — Remove to switch to a URL.</p>
                )}
              </div>
            </div>
          </SettingRow>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Location & Schedule"
        description="Time zone and working windows drive calendars, due dates and iteration scheduling."
        icon={<Globe className="w-4 h-4" />}
      >
        <SettingRow label="Time Zone" description="Default zone for dates, reminders and reports." htmlFor="org-tz">
          <div className="w-full sm:w-80">
            <select
              id="org-tz"
              className="select text-sm"
              value={value.timeZone}
              onChange={(e) => patch({ timeZone: e.target.value })}
            >
              {timeZoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </SettingRow>

        <SettingRow label="Working Days" description="Days considered working time across the organization." stacked>
          <div className="flex items-center gap-2 flex-wrap">
            {WORKING_DAY_OPTIONS.map((d) => {
              const active = value.workingDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-[#0d9488] border-[#0d9488] text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                  title={d.label}
                >
                  {d.short}
                </button>
              );
            })}
            <span className="text-[11px] text-slate-400 ml-1">
              {value.workingDays.length} of 7 selected
            </span>
          </div>
          <FieldError>{errors.workingDays}</FieldError>
        </SettingRow>

        <SettingRow
          label={
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Working Hours
            </span>
          }
          description="The daily working window used for capacity and reminders."
        >
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="time"
              aria-label="Working hours start"
              className={`input text-sm w-full sm:w-32 ${errors.workingHoursStart ? 'border-rose-400' : ''}`}
              value={value.workingHoursStart}
              onChange={(e) => {
                patch({ workingHoursStart: e.target.value });
                setErrors((er) => ({ ...er, workingHoursStart: undefined, workingHoursEnd: undefined }));
              }}
            />
            <span className="text-xs text-slate-400 font-semibold">to</span>
            <input
              type="time"
              aria-label="Working hours end"
              className={`input text-sm w-full sm:w-32 ${errors.workingHoursEnd ? 'border-rose-400' : ''}`}
              value={value.workingHoursEnd}
              onChange={(e) => {
                patch({ workingHoursEnd: e.target.value });
                setErrors((er) => ({ ...er, workingHoursStart: undefined, workingHoursEnd: undefined }));
              }}
            />
          </div>
          <FieldError>{errors.workingHoursEnd || errors.workingHoursStart}</FieldError>
        </SettingRow>
      </SettingsCard>

      <SectionFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => {
          cancel();
          setErrors({});
        }}
        onReset={handleReset}
      />
    </div>
  );
};
