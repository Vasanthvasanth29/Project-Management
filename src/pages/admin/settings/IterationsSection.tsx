import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarRange, ListTree, PlayCircle } from 'lucide-react';
import {
  useAdminSettingsStore,
  type IterationRules,
} from '../../../store/adminSettingsStore';
import { useAuthStore } from '../../../store/authStore';
import { FieldError, SectionFooter, SettingsCard, SettingRow, Toggle, useSectionDraft } from './sectionUi';

interface RuleMeta {
  key: keyof IterationRules;
  label: string;
  description: string;
}

const RULES: RuleMeta[] = [
  {
    key: 'autoNumber',
    label: 'Auto-number iterations',
    description: 'New iterations get the next number from their parent PI automatically (PI 30 → 30.4).',
  },
  {
    key: 'requireGoal',
    label: 'Require an iteration goal',
    description: 'An iteration cannot start until a goal is provided.',
  },
  {
    key: 'preventOverlap',
    label: 'Prevent overlapping iterations',
    description: 'Only one active iteration at a time per project.',
  },
  {
    key: 'workingDaysOnly',
    label: 'Schedule on working days only',
    description: 'Iteration dates avoid non-working days defined in General settings.',
  },
  {
    key: 'autoCarryOver',
    label: 'Auto carry-over incomplete work',
    description: 'Unfinished items automatically move to the next iteration.',
  },
  {
    key: 'lockCompleted',
    label: 'Lock completed iterations',
    description: 'Finished iterations become read-only for everyone.',
  },
];

export const IterationsSection: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const appendAudit = useAdminSettingsStore((s) => s.appendAudit);
  const { value, dirty, patch, cancel, save, reset } = useSectionDraft('iterations');

  const [errors, setErrors] = useState<{ duration?: string }>({});
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const errs: { duration?: string } = {};
    const max = value.durationUnit === 'WEEKS' ? 52 : 365;
    if (!Number.isFinite(value.defaultDuration) || value.defaultDuration < 1)
      errs.duration = 'Duration must be at least 1.';
    else if (value.defaultDuration > max)
      errs.duration = `Duration must be ${max} or fewer for ${value.durationUnit.toLowerCase()}.`;

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    const next = save();
    appendAudit({
      adminId: currentUser?.id || 'admin',
      adminName: currentUser?.name || 'Administrator',
      section: 'iterations',
      category: 'SETTINGS',
      action: 'Updated Iteration settings',
      summary: `Default duration ${next.defaultDuration} ${next.durationUnit.toLowerCase()} · PI-based numbering (PI 30 → 30.4) · ${Object.values(next.rules).filter(Boolean).length} rules active`,
    });
    setTimeout(() => {
      setSaving(false);
      toast.success('Iteration settings saved.');
    }, 200);
  };

  const durationPreview =
    value.durationUnit === 'WEEKS'
      ? `≈ ${Math.max(1, Math.round(value.defaultDuration * 7))} calendar days`
      : `≈ ${Math.max(1, Math.round(value.defaultDuration / 7))} week${Math.round(value.defaultDuration / 7) === 1 ? '' : 's'}`;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Iteration Duration"
        description="Default length applied when a new iteration is created."
        icon={<CalendarRange className="w-4 h-4" />}
      >
        <SettingRow label="Default Duration" description="Adjust per iteration at creation time if needed.">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="number"
              min={1}
              className={`input text-sm w-24 ${errors.duration ? 'border-rose-400' : ''}`}
              value={value.defaultDuration}
              onChange={(e) => {
                patch({ defaultDuration: Math.floor(Number(e.target.value)) || 0 });
                setErrors((er) => ({ ...er, duration: undefined }));
              }}
            />
            <select
              className="select text-sm w-32"
              value={value.durationUnit}
              aria-label="Duration unit"
              onChange={(e) => {
                patch({ durationUnit: e.target.value as typeof value.durationUnit });
                setErrors((er) => ({ ...er, duration: undefined }));
              }}
            >
              <option value="DAYS">Days</option>
              <option value="WEEKS">Weeks</option>
            </select>
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
              {durationPreview}
            </span>
          </div>
          <FieldError>{errors.duration}</FieldError>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="PI-based Iteration Numbering"
        description="Iterations are generated inside a PI and numbered from that PI — no manual name templates."
        icon={<ListTree className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <div className="px-4 py-3 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0f766e] mb-2">How numbers are generated</div>
            <ul className="space-y-1.5 text-xs text-[#134e4a]">
              <li>
                Every iteration belongs to a <span className="font-bold">PI</span> — the Create Iteration form
                requires selecting one (Project → PI → Iteration).
              </li>
              <li>
                The number restarts per PI and increments from the PI's own sequence:{' '}
                <span className="font-mono font-bold">PI 30 → 30.1, 30.2, 30.3</span>{' '}
                while <span className="font-mono font-bold">PI 31 → 31.1, 31.2</span>.
              </li>
              <li>
                Uniqueness is scoped per PI — the same iteration number may exist under different PIs
                (30.1 and 31.1 coexist). Numbers are never a global counter.
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Iteration number</div>
              <div className="text-sm font-semibold font-mono text-slate-800">30.1 → 30.2 → 30.3 → 30.4</div>
              <div className="text-[11px] text-slate-500 mt-1">Scoped to PI 30</div>
            </div>
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Issue identifier</div>
              <div className="text-sm font-semibold font-mono text-slate-800">{'{KEY}'}30.4 → e.g. ECOMM30.4</div>
              <div className="text-[11px] text-slate-500 mt-1">Derived from the PI-based number</div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Iteration Rules"
        description="Organization-wide guardrails applied to iteration lifecycle events."
        icon={<PlayCircle className="w-4 h-4" />}
      >
        {RULES.map((rule) => (
          <SettingRow key={rule.key} label={rule.label} description={rule.description}>
            <Toggle
              checked={value.rules[rule.key]}
              onChange={(next) => patch({ rules: { ...value.rules, [rule.key]: next } })}
            />
          </SettingRow>
        ))}
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
          toast.success('Iteration settings reset to defaults.');
        }}
      />
    </div>
  );
};
