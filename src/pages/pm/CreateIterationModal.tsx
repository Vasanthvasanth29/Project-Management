import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarRange, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { useAdminSettingsStore } from '../../store/adminSettingsStore';
import { iterationNumberExists, nextIterationNumber, sortProjectPis } from '../../utils/programIncrement';
import type { Sprint } from '../../types';

interface CreateIterationModalProps {
  projectId: string;
  isOpen: boolean;
  /** Preselect the PI when opened from that PI's "+ Add Iteration" control. */
  initialPiId?: string;
  onClose: () => void;
  onCreated?: (sprint: Sprint) => void;
}

interface FieldErrors {
  piId?: string;
  iterationNumber?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
}

/** ISO date arithmetic in local time (never shifts across time zones). */
const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Shared PI-aware iteration creation form.
 *
 * Project → PI → Iteration: the Parent PI is required, the iteration number is
 * generated from the selected PI (PI 30 → 30.1, 30.2 … ; PI 31 → 31.1 …),
 * and the default dates honour the organization's configured iteration
 * duration from Admin Settings → Iterations.
 */
export const CreateIterationModal: React.FC<CreateIterationModalProps> = ({
  projectId,
  isOpen,
  initialPiId,
  onClose,
  onCreated,
}) => {
  const { pis, sprints, getNextSprintDates, createSprint } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const iterationsSettings = useAdminSettingsStore((s) => s.settings.iterations);

  const projectPis = sortProjectPis(pis, projectId);
  const durationDays =
    iterationsSettings.durationUnit === 'WEEKS'
      ? Math.max(1, iterationsSettings.defaultDuration) * 7
      : Math.max(1, iterationsSettings.defaultDuration);

  const [piId, setPiId] = useState('');
  const [iterationNumber, setIterationNumber] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [status, setStatus] = useState<'PLANNED' | 'ACTIVE'>('PLANNED');
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset the form each time it opens, seeded from the configured duration.
  useEffect(() => {
    if (!isOpen) return;
    const start = getNextSprintDates(projectId).startDate;
    setStartDate(start);
    setEndDate(addDays(start, durationDays));
    const pi = projectPis.find((p) => p.id === initialPiId);
    if (pi) {
      const next = nextIterationNumber(pi, sprints);
      setPiId(pi.id);
      setIterationNumber(next);
      setName(next);
    } else {
      setPiId('');
      setIterationNumber('');
      setName('');
    }
    setGoal('');
    setStatus('PLANNED');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPiId]);

  // Changing the parent PI regenerates the number from that PI's own sequence.
  const handlePiChange = (value: string) => {
    setPiId(value);
    setErrors((e) => ({ ...e, piId: undefined }));
    const pi = projectPis.find((p) => p.id === value);
    if (pi) {
      const next = nextIterationNumber(pi, sprints);
      setIterationNumber(next);
      setName(next);
    } else {
      setIterationNumber('');
      setName('');
    }
  };

  const handleStartChange = (value: string) => {
    setStartDate(value);
    if (value) setEndDate(addDays(value, durationDays));
    setErrors((e) => ({ ...e, startDate: undefined, endDate: undefined }));
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!piId) errs.piId = 'Select a parent PI — every iteration belongs to a PI.';
    if (!iterationNumber.trim()) errs.iterationNumber = 'Iteration number is required.';
    else if (piId && iterationNumberExists(sprints, piId, iterationNumber)) {
      errs.iterationNumber = `${iterationNumber.trim()} already exists under this PI — numbers must be unique per PI.`;
    }
    if (!startDate) errs.startDate = 'Start date is required.';
    if (!endDate) errs.endDate = 'End date is required.';
    if (startDate && endDate && startDate > endDate) {
      errs.endDate = 'End date must not be before the start date.';
    }
    if (iterationsSettings.rules.requireGoal && !goal.trim()) {
      errs.goal = 'An iteration goal is required by organization settings.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectPis.length === 0) return;
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    const pi = projectPis.find((p) => p.id === piId);
    try {
      const created = createSprint({
        projectId,
        piId,
        iterationNumber: iterationNumber.trim(),
        name: name.trim() || iterationNumber.trim(),
        goal: goal.trim(),
        status,
        startDate,
        endDate,
        taskIds: [],
        createdById: currentUser?.id || 'u-pm-01',
      });
      toast.success(`Iteration ${created.iterationNumber} created under ${pi?.name || 'PI'}`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create iteration.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="text-base font-bold text-[#172b4d]">Create Iteration</h3>
              <p className="text-[11px] text-slate-500">
                Iterations are generated under a PI — the number is derived from the selected PI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {projectPis.length === 0 ? (
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            No PI exists for this project yet. Create a PI first from the Iterations page — every
            iteration must belong to one.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Parent PI * */}
            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="it-pi">
                Parent PI <span className="text-rose-500">*</span>
              </label>
              <select
                id="it-pi"
                className={`w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:border-[#0d9488] ${
                  errors.piId ? 'border-rose-400' : 'border-slate-300'
                }`}
                value={piId}
                onChange={(e) => handlePiChange(e.target.value)}
              >
                <option value="">Select a PI…</option>
                {projectPis.map((pi) => (
                  <option key={pi.id} value={pi.id}>
                    {pi.name}
                  </option>
                ))}
              </select>
              {errors.piId && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.piId}</p>}
            </div>

            {/* Iteration Number */}
            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="it-number">
                Iteration Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="it-number"
                type="text"
                className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[#0d9488] ${
                  iterationsSettings.rules.autoNumber ? 'bg-slate-50 text-slate-600' : 'bg-white'
                } ${errors.iterationNumber ? 'border-rose-400' : 'border-slate-300'}`}
                value={iterationNumber}
                readOnly={iterationsSettings.rules.autoNumber}
                placeholder={piId ? 'e.g. 30.4' : 'Select a PI first'}
                onChange={(e) => {
                  setIterationNumber(e.target.value);
                  setErrors((er) => ({ ...er, iterationNumber: undefined }));
                }}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {iterationsSettings.rules.autoNumber
                  ? 'Auto-numbered from the selected PI (e.g. PI 30 → 30.1, 30.2 …).'
                  : 'Scoped to the selected PI — e.g. PI 30 → 30.4, PI 31 → 31.3.'}
              </p>
              {errors.iterationNumber && (
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.iterationNumber}</p>
              )}
            </div>

            {/* Iteration Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="it-name">
                Iteration Name
              </label>
              <input
                id="it-name"
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0d9488]"
                value={name}
                placeholder="e.g. 30.4"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="it-start">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="it-start"
                  type="date"
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[#0d9488] ${
                    errors.startDate ? 'border-rose-400' : 'border-slate-300'
                  }`}
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
                {errors.startDate && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.startDate}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="it-end">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="it-end"
                  type="date"
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[#0d9488] ${
                    errors.endDate ? 'border-rose-400' : 'border-slate-300'
                  }`}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setErrors((er) => ({ ...er, endDate: undefined }));
                  }}
                />
                {errors.endDate && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.endDate}</p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">
              Defaults to the organization duration ({iterationsSettings.defaultDuration}{' '}
              {iterationsSettings.durationUnit === 'WEEKS' ? 'week' : 'day'}
              {iterationsSettings.defaultDuration === 1 ? '' : 's'}) — override either date as needed.
            </p>

            {/* Goal */}
            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="it-goal">
                Goal {iterationsSettings.rules.requireGoal ? <span className="text-rose-500">*</span> : '(optional)'}
              </label>
              <textarea
                id="it-goal"
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setErrors((er) => ({ ...er, goal: undefined }));
                }}
                placeholder="What is this iteration committing to deliver?"
                className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[#0d9488] resize-none h-16 ${
                  errors.goal ? 'border-rose-400' : 'border-slate-300'
                }`}
                rows={2}
              />
              {errors.goal && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.goal}</p>}
            </div>

            {/* Initial status */}
            <div>
              <span className="block font-bold text-slate-700 mb-1.5">Initial Status</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="createIterationStatus"
                    value="PLANNED"
                    checked={status === 'PLANNED'}
                    onChange={() => setStatus('PLANNED')}
                    className="text-[#0d9488] focus:ring-[#0d9488]"
                  />
                  <span>Planned (Upcoming)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="createIterationStatus"
                    value="ACTIVE"
                    checked={status === 'ACTIVE'}
                    onChange={() => setStatus('ACTIVE')}
                    className="text-[#0d9488] focus:ring-[#0d9488]"
                  />
                  <span>Active (Current)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm px-4 py-2 justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Iteration
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
