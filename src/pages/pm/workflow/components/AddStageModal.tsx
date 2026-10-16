import React, { useState } from 'react';
import { X, Plus, Users, UserCheck, Check } from 'lucide-react';
import { SearchableUserSelect } from '../../../../components/common/SearchableUserSelect';
import { COLOR_PALETTE } from '../workflowUtils';
import type { Team, User, WorkflowStageType } from '../../../../types';

interface AddStageModalProps {
  isOpen: boolean;
  teams: Team[];
  users: User[];
  onClose: () => void;
  onAddStage: (stage: {
    name: string;
    type: WorkflowStageType;
    color: string;
    teamId?: string;
    teamLeaderId?: string;
    description?: string;
  }) => void;
}

export const AddStageModal: React.FC<AddStageModalProps> = ({
  isOpen,
  teams,
  users,
  onClose,
  onAddStage,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [teamId, setTeamId] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddStage({
      name: name.trim(),
      type: 'CUSTOM',
      color,
      teamId: teamId || undefined,
      teamLeaderId: teamLeaderId || undefined,
      description: description.trim() || undefined,
    });

    setName('');
    setColor(COLOR_PALETTE[0]);
    setTeamId('');
    setTeamLeaderId(undefined);
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001d35]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#e0e2ec] shadow-modal w-full max-w-lg overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1f1f] font-display">Add Workflow Stage</h3>
              <p className="text-xs text-[#747775]">Create a new stage in this project's pipeline</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e0e2ec] text-[#747775] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Stage Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">
              Stage Name <span className="text-[#d93025]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Security Audit, Peer Review, Performance Test..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-sm font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
            />
          </div>

          {/* Color Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Color Indicator</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      isSelected ? 'ring-2 ring-offset-2 ring-[#1a73e8] scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsible Team */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#1a73e8]" />
              Responsible Team
            </label>
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setTeamLeaderId(undefined);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
            >
              <option value="">No team assigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Leader */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#1a73e8]" />
              Team Leader
            </label>
            <SearchableUserSelect
              users={users}
              value={teamLeaderId}
              onChange={(id) => setTeamLeaderId(id || undefined)}
              filterRole={['TEAM_LEADER', 'PROJECT_MANAGER', 'ADMIN']}
              filterTeamId={teamId || undefined}
              placeholder="Select Team Leader..."
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Criteria and deliverables for this stage..."
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all resize-none h-18"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#f1f3f4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e0e2ec] hover:bg-[#f0f4f9] text-xs font-semibold text-[#444746] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#0b57d0] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Add Stage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
