import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ListTree, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { sortProjectPis } from '../../utils/programIncrement';
import type { ProgramIncrement } from '../../types';

interface CreatePIModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (pi: ProgramIncrement) => void;
}

/**
 * Creates the parent PI for a project (Project → PI → Iteration). The PI
 * number drives iteration numbering: PI 30 → iterations 30.1, 30.2 …
 */
export const CreatePIModal: React.FC<CreatePIModalProps> = ({ projectId, isOpen, onClose, onCreated }) => {
  const { pis, createProgramIncrement } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const projectPis = sortProjectPis(pis, projectId);
  const nextNumber = projectPis.length
    ? Math.max(...projectPis.map((p) => p.number)) + 1
    : 1;

  const [number, setNumber] = useState(String(nextNumber));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setNumber(String(nextNumber));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(number);
    if (!number.trim() || !Number.isInteger(value) || value < 1) {
      setError('PI number must be a positive whole number (e.g. 30).');
      return;
    }
    if (projectPis.some((p) => p.number === value)) {
      setError(`PI ${value} already exists for this project.`);
      return;
    }
    try {
      const created = createProgramIncrement({ projectId, number: value });
      toast.success(`${created.name} created — iterations under it will be numbered ${value}.1, ${value}.2 …`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PI.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ListTree className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="text-base font-bold text-[#172b4d]">Create PI</h3>
              <p className="text-[11px] text-slate-500">
                Iterations are created inside a PI and numbered from it.
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-bold text-slate-700 mb-1" htmlFor="pi-number">
              PI Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="pi-number"
              type="number"
              min={1}
              step={1}
              className={`w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:border-[#0d9488] ${
                error ? 'border-rose-400' : 'border-slate-300'
              }`}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setError('');
              }}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Displayed as PI {number || '—'} — its iterations will be numbered {number || '…'}.1, {number || '…'}.2 …
            </p>
            {error && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{error}</p>}
          </div>

          <div className="px-4 py-3 rounded-xl bg-[#f0fdfa] border border-[#ccfbf1]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0f766e] mb-1">Preview</div>
            <div className="text-sm font-semibold text-[#134e4a]">PI {number || '—'}</div>
            <div className="text-[11px] text-[#0f766e] mt-0.5">
              {number || '…'}.1 → {number || '…'}.2 → {number || '…'}.3
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
            <button type="submit" className="btn-primary btn-sm px-4 py-2 justify-center">
              <Plus className="w-3.5 h-3.5" />
              Create PI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
