import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X, Search, Link2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { linkEpicToInitiative } from '../../utils/initiativeEpics';
import { StatusBadge } from '../../components/common/Badges';
import { formatShortDate } from '../../utils/dateUtils';
import type { Task } from '../../types';

interface LinkEpicModalProps {
  isOpen: boolean;
  initiative: Task;
  onClose: () => void;
}

/**
 * Link-existing-Epics modal. Lists only Epics from the Initiative's own
 * project that are not already linked — duplicates are impossible to select
 * here and are additionally refused by the link helper. Linking stores the
 * Epic's existing id on the Initiative; the Epic itself is never modified,
 * duplicated or re-parented.
 */
export const LinkEpicModal: React.FC<LinkEpicModalProps> = ({ isOpen, initiative, onClose }) => {
  const { tasks, updateTask } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const linked = useMemo(() => new Set(initiative.linkedEpicIds ?? []), [initiative]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.type !== 'EPIC') return false;
      if (t.projectId !== initiative.projectId) return false;
      if (linked.has(t.id)) return false;
      if (!needle) return true;
      const key = (t.issueKey ?? '').toLowerCase();
      return t.title.toLowerCase().includes(needle) || key.includes(needle);
    });
  }, [tasks, initiative, linked, query]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleLink = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one Epic to link.');
      return;
    }
    let nextIds = [...(initiative.linkedEpicIds ?? [])];
    let linkedCount = 0;
    for (const epicId of selectedIds) {
      const epic = tasks.find((t) => t.id === epicId);
      const res = linkEpicToInitiative({ ...initiative, linkedEpicIds: nextIds }, epic);
      if (!res.ok || !res.linkedEpicIds) {
        toast.error(res.reason || 'Could not link that Epic.');
        return;
      }
      nextIds = res.linkedEpicIds;
      linkedCount += 1;
    }
    // Preserve existing Epic ids and project relationships — only the
    // Initiative's own linkedEpicIds list is written.
    updateTask(initiative.id, { linkedEpicIds: nextIds });
    toast.success(
      `${linkedCount} Epic${linkedCount === 1 ? '' : 's'} linked to "${initiative.title}".`
    );
    setSelectedIds([]);
    setQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e2ec]">
          <h2 className="text-base font-bold text-[#1a1d23]">Link Epics</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f1f3f4] text-[#5e6470] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#5e6470]">
            Link existing Epics from this Initiative's project. Linked Epics keep their own ids,
            parents and status — nothing is copied or re-created.
          </p>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b778c]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Epics by name or key..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin">
            {candidates.length === 0 ? (
              <div className="h-24 rounded-xl border border-dashed border-[#d1d5db] flex items-center justify-center text-xs text-[#9ca3af] px-4 text-center">
                {linked.size > 0 && !query
                  ? 'Every Epic in this project is already linked.'
                  : 'No unlinked Epics found in this project.'}
              </div>
            ) : (
              candidates.map((epic) => {
                const checked = selectedIds.includes(epic.id);
                return (
                  <button
                    key={epic.id}
                    type="button"
                    onClick={() => toggle(epic.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors flex items-start gap-2.5 ${
                      checked
                        ? 'border-[#0d9488] bg-[#f0fdfa]'
                        : 'border-[#e2e5ea] bg-white hover:border-[#0d9488]/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="mt-0.5 rounded border-[#d1d5db] text-[#0d9488] pointer-events-none"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        {epic.issueKey && (
                          <span className="text-[10px] font-bold text-[#0052cc]">{epic.issueKey}</span>
                        )}
                        <StatusBadge status={epic.status} />
                      </span>
                      <span className="block text-xs font-semibold text-[#1a1d23] mt-0.5 truncate">
                        {epic.title}
                      </span>
                      {epic.dueDate && (
                        <span className="block text-[10px] text-[#9ca3af] mt-0.5">
                          Target {formatShortDate(epic.dueDate)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLink}
              disabled={selectedIds.length === 0}
              className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}Epic
              {selectedIds.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
