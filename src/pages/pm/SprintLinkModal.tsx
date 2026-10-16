import React, { useState, useMemo } from 'react';
import {
  X, Link2, GitBranch, AlertTriangle, CheckCircle2,
  Trash2, Plus, ArrowRight, Layers, ExternalLink, ShieldAlert
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { SprintStatusBadge } from '../../components/common/Badges';
import { formatDate } from '../../utils/dateUtils';
import type { Sprint, SprintLinkRelationship } from '../../types';
import { toast } from 'sonner';

interface SprintLinkModalProps {
  sprint: Sprint;
  isOpen: boolean;
  onClose: () => void;
}

const RELATIONSHIPS: {
  value: SprintLinkRelationship;
  label: string;
  description: string;
  color: string;
  badgeBg: string;
}[] = [
  {
    value: 'DEPENDS_ON',
    label: 'Depends On (Prerequisite)',
    description: 'This iteration requires the target iteration to complete first before it can succeed.',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  {
    value: 'BLOCKS',
    label: 'Blocks (Downstream)',
    description: 'The target iteration cannot start or complete until this iteration is finished.',
    color: 'text-rose-700',
    badgeBg: 'bg-rose-50 border-rose-200 text-rose-800',
  },
  {
    value: 'ALIGNED_WITH',
    label: 'Aligned With (Parallel Sync)',
    description: 'Running concurrently as part of a synchronized cross-team release milestone.',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  },
];

export const SprintLinkModal: React.FC<SprintLinkModalProps> = ({
  sprint,
  isOpen,
  onClose,
}) => {
  const {
    projects,
    sprints,
    linkSprints,
    removeSprintLink,
    getSprintLinks,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === sprint.projectId);

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTargetSprintId, setSelectedTargetSprintId] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] =
    useState<SprintLinkRelationship>('DEPENDS_ON');

  // Currently linked sprints for this sprint
  const linkedItems = useMemo(() => {
    return getSprintLinks(sprint.id);
  }, [getSprintLinks, sprint.id]);

  // Available target projects (any project)
  const availableProjects = useMemo(() => {
    return projects;
  }, [projects]);

  // Available sprints for selected project (exclude current sprint)
  const targetProjectSprints = useMemo(() => {
    if (!selectedProjectId) return [];
    return sprints.filter(
      (s) => s.projectId === selectedProjectId && s.id !== sprint.id
    );
  }, [sprints, selectedProjectId, sprint.id]);

  // Add new link handler
  const handleAddLink = () => {
    if (!selectedTargetSprintId) {
      toast.error('Please select a target iteration to link.');
      return;
    }

    linkSprints(sprint.id, selectedTargetSprintId, selectedRelationship);
    setSelectedTargetSprintId('');
    toast.success('Cross-project iteration link created!');
  };

  // Remove link handler
  const handleRemoveLink = (linkId: string) => {
    removeSprintLink(linkId);
    toast.success('Iteration link removed.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div
          className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex-shrink-0 relative border-b border-slate-700/60"
          style={{
            background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)',
            backgroundColor: '#0f172a',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shadow-xs">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white font-display tracking-tight">
                    Cross-Project Iteration Links: {sprint.name}
                  </h2>
                  <SprintStatusBadge status={sprint.status} />
                </div>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    Project: <strong className="text-indigo-200 font-semibold">{currentProject?.name}</strong>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">
                    {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Section 1: Add Link Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Link with Iteration from Another Project
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Select Target Project */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Target Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setSelectedTargetSprintId('');
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">Select project...</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === sprint.projectId ? '(Current Project)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Target Iteration */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Target Iteration
                </label>
                <select
                  value={selectedTargetSprintId}
                  onChange={(e) => setSelectedTargetSprintId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {selectedProjectId ? 'Select iteration...' : 'Choose a project first'}
                  </option>
                  {targetProjectSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Relationship Type */}
            <div className="mt-3.5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                3. Relationship Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RELATIONSHIPS.map((rel) => (
                  <button
                    key={rel.value}
                    type="button"
                    onClick={() => setSelectedRelationship(rel.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedRelationship === rel.value
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 mb-0.5">
                      {rel.label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight">
                      {rel.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Link Button */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!selectedTargetSprintId}
                className="btn-primary text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Establish Cross-Project Link</span>
              </button>
            </div>
          </div>

          {/* Section 2: Active Linked Iterations List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Active Linked Iterations ({linkedItems.length})
                </h3>
              </div>
            </div>

            {linkedItems.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Link2 className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-semibold">No iteration dependencies linked yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Connect this iteration to backend, mobile, or core services iterations in other projects above.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {linkedItems.map((item) => {
                  const relDef = RELATIONSHIPS.find((r) => r.value === item.link.relationship);
                  const isBlocked = item.isBlocked;

                  return (
                    <div
                      key={item.link.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isBlocked
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-white shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isBlocked
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {isBlocked ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <GitBranch className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                              {item.otherProject.name}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-900">
                              {item.otherSprint.name}
                            </span>
                            <SprintStatusBadge status={item.otherSprint.status} />
                          </div>

                          <div className="flex items-center gap-2 text-[11px] flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md border font-semibold ${
                                relDef?.badgeBg || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.direction === 'outgoing'
                                ? relDef?.label
                                : `Target has: ${relDef?.label}`}
                            </span>

                            {isBlocked && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                                <ShieldAlert className="w-3 h-3" />
                                Uncompleted Upstream Prerequisite
                              </span>
                            )}

                            <span className="text-slate-400 text-[10px]">
                              {formatDate(item.otherSprint.startDate)} → {formatDate(item.otherSprint.endDate)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Remove link button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(item.link.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                        title="Unlink iteration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Linked iteration dependencies are tracked on the Cross-Project Roadmap and warn if prerequisite iterations are not yet completed.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary text-xs px-5 py-2 bg-slate-900 hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
