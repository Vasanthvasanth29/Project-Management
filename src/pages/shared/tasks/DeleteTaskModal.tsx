import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { TaskTypeBadge } from './TaskTypeBadge';
import type { Task } from '../../../types';

interface DeleteTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onConfirm,
}) => {
  const { tasks } = useAppStore();

  if (!isOpen || !task) return null;

  // Calculate children impact
  const directChildren = tasks.filter((t) => t.parentId === task.id);
  const childIds = new Set(directChildren.map((t) => t.id));
  const grandChildren = tasks.filter((t) => t.parentId && childIds.has(t.parentId));

  const totalDescendants = directChildren.length + grandChildren.length;

  return (
    <div className="fixed inset-0 bg-[#001d35]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-md overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4] bg-[#fdf2f2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#fee2e2] text-[#dc2626] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#b91c1c] font-display">Delete Work Item</h3>
              <p className="text-xs text-[#747775]">Confirm cascading removal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#fee2e2] text-[#747775] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#f8fafd] border border-[#e0e2ec]">
            <TaskTypeBadge type={task.type} />
            <span className="font-bold text-[#1f1f1f] truncate">{task.title}</span>
          </div>

          {totalDescendants > 0 ? (
            <div className="p-4 rounded-2xl bg-[#fff8e1] border border-[#ffe082] text-[#b45309] space-y-2">
              <p className="font-bold text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#b45309] flex-shrink-0" />
                <span>Cascade deletion warning</span>
              </p>
              <p className="text-xs leading-relaxed">
                Deleting this {task.type.toLowerCase()} will also permanently delete{' '}
                <strong className="font-bold text-[#92400e]">{directChildren.length} child {directChildren.length === 1 ? 'item' : 'items'}</strong>
                {grandChildren.length > 0 && (
                  <span> and <strong className="font-bold text-[#92400e]">{grandChildren.length} sub-items</strong></span>
                )}
                . This action cannot be undone.
              </p>
            </div>
          ) : (
            <p className="text-[#444746] text-xs">
              Are you sure you want to delete this {task.type.toLowerCase()}? This action cannot be undone.
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#f1f3f4] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e0e2ec] hover:bg-[#f0f4f9] text-xs font-semibold text-[#444746] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-5 py-2 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete {totalDescendants > 0 ? `(${totalDescendants + 1} items)` : 'Item'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
