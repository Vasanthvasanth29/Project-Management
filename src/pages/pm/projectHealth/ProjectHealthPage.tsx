import React, { useState, useMemo, useCallback } from 'react';
import {
  HeartPulse, RefreshCw, Clock, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toUrlId, getProjectUrl } from '../../../utils/idUtils';
import { issuePath } from '../../../utils/issueUrl';
import { useAuthStore } from '../../../store/authStore';
import { useAppStore } from '../../../store/appStore';
import { ProjectHealthScore } from './ProjectHealthScore';
import { HealthFactorCard } from './HealthFactorCard';
import { RiskCenter } from './RiskCenter';
import { SprintPrediction } from './SprintPrediction';
import { WorkloadRisk } from './WorkloadRisk';
import { BottleneckSection } from './BottleneckCard';
import { HealthTrend } from './HealthTrend';
import { EarlyWarningTimeline } from './EarlyWarningTimeline';
import { WhatChanged } from './WhatChanged';
import { ActionIntelligence } from './ActionIntelligence';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { ProjectSignals } from './ProjectSignals';
import { ProjectOutlook } from './ProjectOutlook';
import { DecisionTimeline } from './DecisionTimeline';
import { computeDecisionTimeline } from './computeDecisionTimeline';
import {
  computeDeliveryHealth,
  computeSprintHealth,
  computeTaskHealth,
  computeTeamWorkload,
  computeQualityHealth,
  computeDependencyHealth,
  computeOverallHealth,
  getHealthStatus,
  getScoreExplanation,
  detectRisks,
  computeSprintPrediction,
  computeWorkloadMembers,
  computeBottlenecks,
  computeEarlyWarnings,
  computeWhatChanged,
  computeConfidence,
  generateInsight,
  computeActionIntelligence,
} from './healthCalculations';
import { computeProjectSignals } from './computeProjectSignals';

export const ProjectHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { projects, sprints, tasks, bugs, users, taskDependencies } = useAppStore();

  // ADMIN and PROJECT_MANAGER see every project's health (Access Any Project);
  // TEAM_LEADER sees the projects where it leads an iteration; MEMBER stays
  // scoped to projects it manages. Archived projects are excluded until restored.
  const myProjects = useMemo(
    () => {
      const visible = projects.filter(p => !p.isArchived);
      const role = currentUser?.role;
      if (role === 'ADMIN' || role === 'PROJECT_MANAGER') return visible;
      if (role === 'TEAM_LEADER') {
        return visible.filter(p =>
          sprints.some(s => s.projectId === p.id && s.teamLeaderId === currentUser?.id)
        );
      }
      return visible.filter(p => p.projectManagerId === currentUser?.id);
    },
    [projects, sprints, currentUser]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => myProjects[0]?.id || ''
  );
  const [lastAnalyzed] = useState<string>(new Date().toISOString());
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const selectedProject = useMemo(
    () => myProjects.find(p => p.id === selectedProjectId) || myProjects[0],
    [myProjects, selectedProjectId]
  );

  const projectTasks = useMemo(
    () => tasks.filter(t => t.projectId === selectedProject?.id),
    [tasks, selectedProject]
  );

  const projectBugs = useMemo(
    () => bugs.filter(b => b.projectId === selectedProject?.id),
    [bugs, selectedProject]
  );

  const projectSprints = useMemo(
    () => sprints.filter(s => s.projectId === selectedProject?.id),
    [sprints, selectedProject]
  );

  const projectDeps = useMemo(
    () => taskDependencies.filter(d => {
      const task = tasks.find(t => t.id === d.taskId);
      return task?.projectId === selectedProject?.id;
    }),
    [taskDependencies, tasks, selectedProject]
  );

  const factors = useMemo(() => [
    computeDeliveryHealth(projectTasks),
    computeSprintHealth(projectSprints, projectTasks),
    computeTaskHealth(projectTasks),
    computeTeamWorkload(projectTasks, users),
    computeQualityHealth(projectBugs, projectTasks),
    computeDependencyHealth(projectDeps, projectTasks),
  ], [projectTasks, projectSprints, projectBugs, projectDeps, users]);

  const overallScore = useMemo(() => computeOverallHealth(factors), [factors]);
  const overallStatus = getHealthStatus(overallScore);
  const { mainReasons, positiveSignals } = useMemo(() => getScoreExplanation(factors), [factors]);
  const risks = useMemo(() => detectRisks(projectTasks, projectSprints, projectBugs, projectDeps, users), [projectTasks, projectSprints, projectBugs, projectDeps, users]);
  const activeSprint = projectSprints.find(s => s.status === 'ACTIVE');
  const prediction = useMemo(() => computeSprintPrediction(activeSprint, projectTasks), [activeSprint, projectTasks]);
  const workloadMembers = useMemo(() => computeWorkloadMembers(projectTasks, users), [projectTasks, users]);
  const bottlenecks = useMemo(() => computeBottlenecks(projectTasks), [projectTasks]);
  const healthTrend = useMemo(() => {
    const variance = Math.round(overallScore * 0.08);
    return [overallScore - variance - 4, overallScore - variance, overallScore - Math.round(variance * 0.5) + 2, overallScore];
  }, [overallScore]);
  const insight = useMemo(() => generateInsight(overallScore, factors, risks), [overallScore, factors, risks]);

  // New: Early Warning, What Changed, Action Intelligence
  const earlyWarnings = useMemo(
    () => computeEarlyWarnings(projectTasks, projectSprints, projectBugs, users),
    [projectTasks, projectSprints, projectBugs, users]
  );
  const whatChanged = useMemo(
    () => computeWhatChanged(factors, risks, overallScore, projectBugs, projectTasks, workloadMembers),
    [factors, risks, overallScore, projectBugs, projectTasks, workloadMembers]
  );
  const actionIntelligence = useMemo(
    () => computeActionIntelligence(projectTasks, projectSprints, projectBugs, projectDeps, users),
    [projectTasks, projectSprints, projectBugs, projectDeps, users]
  );
  const analysisConfidence = useMemo(
    () => computeConfidence(
      projectTasks.filter(t => t.type !== 'EPIC' && t.status !== 'DONE').length,
      !!activeSprint,
      3,
    ),
    [projectTasks, activeSprint]
  );

  // Predictive Project Signals
  const projectSignalsResult = useMemo(
    () => computeProjectSignals(projectTasks, projectSprints, projectBugs, projectDeps, users),
    [projectTasks, projectSprints, projectBugs, projectDeps, users]
  );

  // Decision Timeline
  const decisionTimeline = useMemo(
    () => computeDecisionTimeline({
      factors,
      overallScore,
      risks,
      actionIntelligence,
      projectSignals: projectSignalsResult.signals,
      outlook: projectSignalsResult.outlook,
      outlookReason: projectSignalsResult.outlookReason,
      sprintPrediction: prediction,
      workloadMembers,
      bottlenecks,
      activeTaskCount: projectTasks.filter(t => t.status !== 'DONE').length,
      overdueTaskCount: projectTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date()).length,
      openBugCount: projectBugs.filter(b => b.status !== 'CLOSED' && b.status !== 'FIXED').length,
      criticalBugCount: projectBugs.filter(b => b.severity === 'CRITICAL' && b.status !== 'CLOSED' && b.status !== 'FIXED').length,
      blockedTaskCount: projectTasks.filter(t => t.status === 'BLOCKED').length,
      totalMemberCount: workloadMembers.length,
      overloadedMemberCount: workloadMembers.filter(m => m.status === 'overloaded').length,
    }),
    [factors, overallScore, risks, actionIntelligence, projectSignalsResult, prediction, workloadMembers, bottlenecks, projectTasks, projectBugs]
  );

  const handleNavigate = useCallback((type: string, id?: string) => {
    if (!selectedProject) return;
    const projBase = getProjectUrl(selectedProject, currentUser?.role);
    switch (type) {
      case 'task':
        // Canonical issue URL — the workspace ignores ?taskId, so open the
        // issue's own detail page instead of a dead parameter.
        if (id) navigate(issuePath(id));
        else navigate(`${projBase}?tab=work-items`);
        break;
      case 'bug':
        navigate(`${projBase}?tab=work-items`);
        break;
      case 'sprint':
      case 'move-sprint':
        if (id) navigate(`${projBase}/sprints/${toUrlId(id)}`);
        else navigate(`${projBase}/iterations`);
        break;
      case 'project':
        navigate(projBase);
        break;
      case 'member':
        navigate(`${projBase}?tab=team-hub`);
        break;
      default:
        navigate(projBase);
    }
  }, [navigate, selectedProject]);

  const handleAction = useCallback((type: string, targetId?: string) => {
    handleNavigate(type, targetId);
  }, [handleNavigate]);

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #0d9488 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#2dd4bf] text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
              <HeartPulse className="w-3.5 h-3.5" />
              Project Intelligence
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display">
              Early Warning & Action Center
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              What is going wrong, what may happen next, and what to do now.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <span className="truncate max-w-[140px]">{selectedProject?.name || 'Select Project'}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showProjectDropdown && (
                <div className="absolute top-full mt-1 left-0 w-56 bg-white rounded-xl shadow-xl border border-[#e2e5ea] z-50 py-1">
                  {myProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProjectId(p.id); setShowProjectDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#f1f5f9] transition-colors ${
                        p.id === selectedProjectId ? 'text-[#0d9488] bg-[#f0fdfa]' : 'text-[#1a1d23]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  {myProjects.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[#9ca3af]">No projects assigned</div>
                  )}
                </div>
              )}
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm">
              <RefreshCw className="w-3.5 h-3.5" />
              Analyze
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" />
              Last analyzed: {formatTimestamp(lastAnalyzed)}
            </div>
          </div>
        </div>
      </div>

      {/* ACTION INTELLIGENCE — Do This First + Action Queue */}
      <ActionIntelligence items={actionIntelligence} onAction={handleAction} />

      {/* Overall Health + Confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <ProjectHealthScore
          score={overallScore}
          status={overallStatus}
          trend={healthTrend[healthTrend.length - 1] - healthTrend[healthTrend.length - 2]}
          mainReasons={mainReasons}
          positiveSignals={positiveSignals}
        />
        <div className="lg:col-span-3 space-y-5">
          <HealthTrend scores={healthTrend} />
          <ConfidenceIndicator confidence={analysisConfidence} />
        </div>
      </div>

      {/* Health Factors */}
      <div>
        <h2 className="section-title">Health Factors</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {factors.map(f => (
            <HealthFactorCard key={f.id} factor={f} />
          ))}
        </div>
      </div>

      {/* Early Warning Timeline + What Changed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EarlyWarningTimeline warnings={earlyWarnings} onNavigate={handleNavigate} />
        <WhatChanged changes={whatChanged} />
      </div>

      {/* Risk Center */}
      <RiskCenter risks={risks} onAction={handleAction} />

      {/* Project Outlook + Predictive Signals */}
      <div className="space-y-4">
        <ProjectOutlook
          outlook={projectSignalsResult.outlook}
          reason={projectSignalsResult.outlookReason}
          signalCount={projectSignalsResult.signals.length}
        />
        <ProjectSignals
          signals={projectSignalsResult.signals}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Decision Timeline */}
      <DecisionTimeline snapshot={decisionTimeline} onNavigate={handleNavigate} />

      {/* Iteration Prediction + Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {prediction && <SprintPrediction prediction={prediction} />}
        <WorkloadRisk members={workloadMembers} />
      </div>

      {/* Bottlenecks */}
      <BottleneckSection bottlenecks={bottlenecks} />

      {/* Insight */}
      <div className="card p-6" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #eff6ff 100%)' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ccfbf1] flex items-center justify-center flex-shrink-0">
            <HeartPulse className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1a1d23] mb-1.5 font-display">Project Insight Summary</h3>
            <p className="text-[11px] text-[#4b5563] leading-relaxed">{insight}</p>
            <p className="text-[9px] text-[#9ca3af] mt-2 italic">
              Auto-generated from current project metrics. Use as guidance, not as a definitive assessment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
