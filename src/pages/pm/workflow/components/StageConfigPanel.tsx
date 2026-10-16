import React, { useState } from 'react';
import { X, Users, UserCheck, Trash2, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { SearchableUserSelect } from '../../../../components/common/SearchableUserSelect';
import { COLOR_PALETTE } from '../workflowUtils';
import type { WorkflowStage, Team, User } from '../../../../types';

interface StageConfigPanelProps {
  stage: WorkflowStage;
  teams: Team[];
  users: User[];
  onUpdateStage: (updates: Partial<WorkflowStage>) => void;
  onDeleteStage: (stageId: string) => void;
  onClose: () => void;
}

export const StageConfigPanel: React.FC<StageConfigPanelProps> = ({
  stage,
  teams,
  users,
  onUpdateStage,
  onDeleteStage,
  onClose,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="h-full flex flex-col bg-white border border-[#e0e2ec] rounded-3xl shadow-sm overflow-hidden animate-slide-in">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#f1f3f4] bg-[#f8fafd]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-2xs"
            style={{ backgroundColor: stage.color || '#1a73e8' }}
          />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#747775]">Stage Configuration</span>
            <h3 className="text-sm font-bold text-[#1f1f1f] truncate font-display">{stage.name}</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-[#e0e2ec] text-[#747775] transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Stage Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Stage Name</label>
          <input
            type="text"
            value={stage.name}
            onChange={(e) => onUpdateStage({ name: e.target.value })}
            placeholder="e.g. Planning, Development..."
            className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-sm font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
          />
        </div>

        {/* Color Picker Swatches */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Stage Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PALETTE.map((c) => {
              const isSelected = stage.color?.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdateStage({ color: c })}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                    isSelected ? 'ring-2 ring-offset-2 ring-[#1a73e8] scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
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
            value={stage.teamId || ''}
            onChange={(e) => onUpdateStage({ teamId: e.target.value || undefined, teamLeaderId: undefined })}
            className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all"
          >
            <option value="">No team assigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Team Leader Select */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#1a73e8]" />
            Team Leader
          </label>
          <SearchableUserSelect
            users={users}
            value={stage.teamLeaderId}
            onChange={(id) => onUpdateStage({ teamLeaderId: id || undefined })}
            filterRole={['TEAM_LEADER', 'PROJECT_MANAGER', 'ADMIN']}
            filterTeamId={stage.teamId}
            placeholder="Assign Team Leader..."
          />
          <p className="text-[10px] text-[#747775]">
            {stage.teamId ? 'Showing leaders eligible for the selected team.' : 'Select a team first to narrow down team leaders.'}
          </p>
        </div>

        {/* Stage Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#444746] uppercase tracking-wider">Description</label>
          <textarea
            value={stage.description || ''}
            onChange={(e) => onUpdateStage({ description: e.target.value })}
            placeholder="Explain the workflow criteria, goals, and responsibilities for this stage..."
            className="w-full px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#e0e2ec] text-xs text-[#1f1f1f] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-all resize-none h-20"
          />
        </div>

        {/* Stage Metadata */}
        <div className="p-3 rounded-2xl bg-[#f8fafd] border border-[#e0e2ec] space-y-1 text-[11px]">
          <div className="flex justify-between text-[#747775]">
            <span>Sequence order:</span>
            <span className="font-bold text-[#1f1f1f]">#{stage.order}</span>
          </div>
          <div className="flex justify-between text-[#747775]">
            <span>Stage Type:</span>
            <span className="font-semibold text-[#1a73e8]">{stage.type}</span>
          </div>
        </div>
      </div>

      {/* Panel Footer / Delete Action */}
      <div className="p-4 border-t border-[#f1f3f4] bg-[#f8fafd]">
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 px-3 rounded-xl border border-[#fce8e6] bg-white hover:bg-[#fce8e6] text-[#d93025] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Stage</span>
          </button>
        ) : (
          <div className="p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] space-y-2 animate-scale-in">
            <div className="flex items-start gap-2 text-[11px] text-[#b3261e] font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#d93025]" />
              <span>Delete stage "{stage.name}" and remove all connected transitions?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDeleteStage(stage.id)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-[#d93025] hover:bg-[#b3261e] text-white text-xs font-semibold text-center transition-colors"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-[#444746] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
