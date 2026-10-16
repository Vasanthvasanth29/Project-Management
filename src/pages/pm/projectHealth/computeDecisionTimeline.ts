import type {
  HealthFactor,
  ProjectRisk,
  ActionIntelligenceItem,
  SprintPredictionData,
  TeamWorkloadMember,
  BottleneckData,
} from './healthCalculations';
import type { ProjectSignal, ProjectOutlook } from './computeProjectSignals';
import { getCurrentDate } from '../../../utils/dateUtils';
import { safeDaysBetween } from '../../../utils/calculationUtils';

// ============================================================
// TYPES
// ============================================================

export type TimelineEventType =
  | 'delivery-signal'
  | 'risk-escalation'
  | 'workload-shift'
  | 'quality-signal'
  | 'dependency-signal'
  | 'sprint-outlook'
  | 'positive-signal';

export type TimelineSeverity = 'critical' | 'high' | 'medium' | 'low' | 'positive';

export interface DecisionTimelineItem {
  id: string;
  timestamp: string | null;
  type: TimelineEventType;
  severity: TimelineSeverity;
  title: string;
  summary: string;
  evidence: string;
  impact: string;
  decision: string;
  likelyOutcome: string;
  affectedItem: string;
  navigationTarget: { type: string; id?: string; tab?: string };
  isPositive: boolean;
}

export interface DecisionTimelineSnapshot {
  outlook: ProjectOutlook;
  activeSignals: number;
  highestSeverity: TimelineSeverity;
  mostImportantDecision: string;
  items: DecisionTimelineItem[];
}

// ============================================================
// INPUTS — all pre-computed by existing modules
// ============================================================

export interface DecisionTimelineInputs {
  factors: HealthFactor[];
  overallScore: number;
  risks: ProjectRisk[];
  actionIntelligence: ActionIntelligenceItem[];
  projectSignals: ProjectSignal[];
  outlook: ProjectOutlook;
  outlookReason: string;
  sprintPrediction: SprintPredictionData | null;
  workloadMembers: TeamWorkloadMember[];
  bottlenecks: BottleneckData[];
  activeTaskCount: number;
  overdueTaskCount: number;
  openBugCount: number;
  criticalBugCount: number;
  blockedTaskCount: number;
  totalMemberCount: number;
  overloadedMemberCount: number;
}

// ============================================================
// SEVERITY ORDERING
// ============================================================

const SEVERITY_ORDER: Record<TimelineSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  positive: 4,
};

// ============================================================
// HELPERS
// ============================================================

function getFactorScore(factors: HealthFactor[], id: string): number {
  return factors.find(f => f.id === id)?.score ?? 50;
}

function getFactorStatus(factors: HealthFactor[], id: string): string {
  return factors.find(f => f.id === id)?.status ?? 'healthy';
}

function earliestSourceDate(...dates: (string | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return null;
  return valid.sort()[0];
}

// ============================================================
// SIGNAL DETECTORS
// ============================================================

function detectDeliverySignals(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];
  const now = getCurrentDate();
  const deliveryScore = getFactorScore(inputs.factors, 'delivery');
  const overdueRatio = inputs.activeTaskCount > 0
    ? inputs.overdueTaskCount / inputs.activeTaskCount
    : 0;

  if (inputs.overdueTaskCount > 0 && inputs.sprintPrediction) {
    const sprintDaysLeft = inputs.sprintPrediction.remainingTasks > 0
      ? Math.max(1, safeDaysBetween(now.toISOString(), inputs.sprintPrediction.sprintName))
      : 0;

    const severity: TimelineSeverity =
      overdueRatio > 0.4 || inputs.sprintPrediction.probability < 30
        ? 'critical'
        : overdueRatio > 0.2 || inputs.sprintPrediction.probability < 60
          ? 'high'
          : 'medium';

    const overdueAction = inputs.actionIntelligence.find(
      a => a.category === 'overdue-task'
    );

    items.push({
      id: 'delivery-signal-1',
      timestamp: earliestSourceDate(...inputs.risks.map(r => r.affectedItem)),
      type: 'delivery-signal',
      severity,
      title: 'Delivery pressure detected',
      summary: `${inputs.overdueTaskCount} active task${inputs.overdueTaskCount !== 1 ? 's are' : ' is'} overdue while the iteration has limited time remaining.`,
      evidence: `${inputs.overdueTaskCount} of ${inputs.activeTaskCount} active tasks are past their due date. Iteration completion probability is ${inputs.sprintPrediction.probability}%.`,
      impact: 'Iteration completion may be delayed. Remaining work may spill over.',
      decision: overdueAction?.recommendedAction ?? 'Prioritize overdue high-impact tasks.',
      likelyOutcome: 'Without intervention, remaining work may spill into the next iteration.',
      affectedItem: inputs.sprintPrediction.sprintName,
      navigationTarget: { type: 'sprint', tab: 'iterations' },
      isPositive: false,
    });
  }

  if (deliveryScore >= 75 && inputs.overdueTaskCount === 0 && inputs.activeTaskCount > 0) {
    items.push({
      id: 'delivery-positive-1',
      timestamp: null,
      type: 'positive-signal',
      severity: 'positive',
      title: 'Delivery outlook is stable',
      summary: 'All active tasks are within their deadlines and delivery health is strong.',
      evidence: `Delivery health score is ${deliveryScore}%. No overdue tasks detected among ${inputs.activeTaskCount} active tasks.`,
      impact: 'Near-term delivery risk is low.',
      decision: 'Continue monitoring current priorities.',
      likelyOutcome: 'Steady progress toward iteration goals.',
      affectedItem: 'Delivery health',
      navigationTarget: { type: 'project' },
      isPositive: true,
    });
  }

  return items;
}

function detectRiskEscalations(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];

  const criticalRisks = inputs.risks.filter(r => r.severity === 'critical');
  const highRisks = inputs.risks.filter(r => r.severity === 'high');

  if (criticalRisks.length > 0) {
    const risk = criticalRisks[0];
    items.push({
      id: 'risk-escalation-critical',
      timestamp: null,
      type: 'risk-escalation',
      severity: 'critical',
      title: 'Critical delivery risk',
      summary: risk.title,
      evidence: risk.explanation,
      impact: risk.impact,
      decision: risk.suggestedAction,
      likelyOutcome: 'High probability of iteration disruption if unresolved.',
      affectedItem: risk.affectedItem,
      navigationTarget: {
        type: risk.actionType === 'navigate-task' ? 'task' : risk.actionType === 'fix-bug' ? 'bug' : 'project',
        id: risk.actionTargetId,
      },
      isPositive: false,
    });
  }

  if (highRisks.length > 0 && criticalRisks.length === 0) {
    const risk = highRisks[0];
    items.push({
      id: 'risk-escalation-high',
      timestamp: null,
      type: 'risk-escalation',
      severity: 'high',
      title: 'Elevated project risk',
      summary: risk.title,
      evidence: risk.explanation,
      impact: risk.impact,
      decision: risk.suggestedAction,
      likelyOutcome: 'Risk may escalate if not addressed promptly.',
      affectedItem: risk.affectedItem,
      navigationTarget: {
        type: risk.actionType === 'navigate-task' ? 'task' : risk.actionType === 'fix-bug' ? 'bug' : 'project',
        id: risk.actionTargetId,
      },
      isPositive: false,
    });
  }

  return items;
}

function detectWorkloadShifts(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];

  if (inputs.overloadedMemberCount > 0 && inputs.totalMemberCount > 0) {
    const overloadRatio = inputs.overloadedMemberCount / inputs.totalMemberCount;
    const overloaded = inputs.workloadMembers.filter(m => m.status === 'overloaded');
    const topOverloaded = overloaded[0];

    const severity: TimelineSeverity =
      overloadRatio > 0.5 || inputs.overloadedMemberCount >= 3
        ? 'critical'
        : overloadRatio > 0.3 || inputs.overloadedMemberCount >= 2
          ? 'high'
          : 'medium';

    items.push({
      id: 'workload-shift-1',
      timestamp: null,
      type: 'workload-shift',
      severity,
      title: 'Workload concentration detected',
      summary: `${inputs.overloadedMemberCount} team member${inputs.overloadedMemberCount !== 1 ? 's are' : ' is'} carrying a disproportionate share of active work.`,
      evidence: `${inputs.overloadedMemberCount} of ${inputs.totalMemberCount} members are overloaded. ${topOverloaded ? `${topOverloaded.name} has ${topOverloaded.assignedTasks} assigned tasks.` : ''}`,
      impact: 'Delivery may depend too heavily on specific team members.',
      decision: 'Review workload distribution and consider reassignment.',
      likelyOutcome: 'Risk of burnout and delivery bottlenecks if workload remains concentrated.',
      affectedItem: topOverloaded?.name ?? 'Team workload',
      navigationTarget: { type: 'member', tab: 'team-hub' },
      isPositive: false,
    });
  }

  if (inputs.overloadedMemberCount === 0 && inputs.totalMemberCount > 0) {
    items.push({
      id: 'workload-positive-1',
      timestamp: null,
      type: 'positive-signal',
      severity: 'positive',
      title: 'Workload is balanced',
      summary: 'No team members are overloaded. Work distribution is healthy.',
      evidence: `All ${inputs.totalMemberCount} team members have manageable workload levels.`,
      impact: 'Team capacity is well-utilized without burnout risk.',
      decision: 'Maintain current task assignments.',
      likelyOutcome: 'Sustainable delivery pace across the team.',
      affectedItem: 'Team workload',
      navigationTarget: { type: 'member', tab: 'team-hub' },
      isPositive: true,
    });
  }

  return items;
}

function detectQualitySignals(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];
  const qualityScore = getFactorScore(inputs.factors, 'quality');

  if (inputs.criticalBugCount > 0) {
    const criticalBugAction = inputs.actionIntelligence.find(
      a => a.category === 'critical-bug'
    );

    items.push({
      id: 'quality-signal-critical',
      timestamp: null,
      type: 'quality-signal',
      severity: 'critical',
      title: 'Quality risk detected',
      summary: `${inputs.criticalBugCount} critical-severity bug${inputs.criticalBugCount !== 1 ? 's are' : ' is'} open.`,
      evidence: `${inputs.criticalBugCount} critical bugs remain unresolved out of ${inputs.openBugCount} open bugs. Quality health score is ${qualityScore}%.`,
      impact: 'Release quality may be affected.',
      decision: criticalBugAction?.recommendedAction ?? 'Review high-severity bugs before progressing.',
      likelyOutcome: 'Unresolved critical bugs may block release or cause production issues.',
      affectedItem: `${inputs.criticalBugCount} critical bug${inputs.criticalBugCount !== 1 ? 's' : ''}`,
      navigationTarget: { type: 'bug', tab: 'work-items' },
      isPositive: false,
    });
  } else if (inputs.openBugCount > 0 && qualityScore < 50) {
    items.push({
      id: 'quality-signal-medium',
      timestamp: null,
      type: 'quality-signal',
      severity: 'medium',
      title: 'Bug work queue growing',
      summary: `${inputs.openBugCount} open bug${inputs.openBugCount !== 1 ? 's' : ''} with declining quality health.`,
      evidence: `Quality health score is ${qualityScore}%. ${inputs.openBugCount} bugs remain open.`,
      impact: 'Accumulating bugs may slow feature development.',
      decision: 'Allocate time for bug triage and resolution.',
      likelyOutcome: 'Bug work queue may impact iteration velocity if unaddressed.',
      affectedItem: `${inputs.openBugCount} open bug${inputs.openBugCount !== 1 ? 's' : ''}`,
      navigationTarget: { type: 'bug', tab: 'work-items' },
      isPositive: false,
    });
  }

  if (qualityScore >= 75 && inputs.criticalBugCount === 0 && inputs.openBugCount === 0) {
    items.push({
      id: 'quality-positive-1',
      timestamp: null,
      type: 'positive-signal',
      severity: 'positive',
      title: 'Quality health is strong',
      summary: 'No open bugs detected. Quality metrics are healthy.',
      evidence: `Quality health score is ${qualityScore}%. All bugs are resolved.`,
      impact: 'Release quality confidence is high.',
      decision: 'Maintain current quality practices.',
      likelyOutcome: 'Low risk of quality-related release blockers.',
      affectedItem: 'Quality health',
      navigationTarget: { type: 'project' },
      isPositive: true,
    });
  }

  return items;
}

function detectDependencySignals(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];
  const depScore = getFactorScore(inputs.factors, 'dependencies');

  if (inputs.blockedTaskCount > 0) {
    const depAction = inputs.actionIntelligence.find(
      a => a.category === 'dependency-blocked' || a.category === 'blocked-task'
    );

    const severity: TimelineSeverity =
      depScore < 30 || inputs.blockedTaskCount >= 3
        ? 'critical'
        : depScore < 50 || inputs.blockedTaskCount >= 2
          ? 'high'
          : 'medium';

    items.push({
      id: 'dependency-signal-1',
      timestamp: null,
      type: 'dependency-signal',
      severity,
      title: 'Dependency chain detected',
      summary: `${inputs.blockedTaskCount} task${inputs.blockedTaskCount !== 1 ? 's are' : ' is'} blocked by unresolved dependencies.`,
      evidence: `${inputs.blockedTaskCount} tasks cannot progress due to blocking dependencies. Dependency health score is ${depScore}%.`,
      impact: 'Multiple downstream tasks may be delayed.',
      decision: depAction?.recommendedAction ?? 'Resolve the blocking dependencies first.',
      likelyOutcome: 'Blocked dependencies may cascade delays across dependent work.',
      affectedItem: `${inputs.blockedTaskCount} blocked task${inputs.blockedTaskCount !== 1 ? 's' : ''}`,
      navigationTarget: { type: 'task', tab: 'work-items' },
      isPositive: false,
    });
  } else if (depScore >= 75 && inputs.activeTaskCount > 0) {
    items.push({
      id: 'dependency-positive-1',
      timestamp: null,
      type: 'positive-signal',
      severity: 'positive',
      title: 'Dependencies are clear',
      summary: 'No blocking dependencies detected. Task execution flow is unobstructed.',
      evidence: `Dependency health score is ${depScore}%. All ${inputs.activeTaskCount} active tasks have their dependencies resolved.`,
      impact: 'Tasks can progress without external blockers.',
      decision: 'Continue monitoring dependency health.',
      likelyOutcome: 'Smooth task execution flow.',
      affectedItem: 'Dependency health',
      navigationTarget: { type: 'project' },
      isPositive: true,
    });
  }

  return items;
}

function detectSprintOutlook(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];

  if (inputs.sprintPrediction) {
    const pred = inputs.sprintPrediction;
    const severity: TimelineSeverity =
      pred.probability < 30
        ? 'critical'
        : pred.probability < 60
          ? 'high'
          : pred.probability < 80
            ? 'medium'
            : 'positive';

    const isPositive = severity === 'positive';

    items.push({
      id: 'sprint-outlook-1',
      timestamp: null,
      type: 'sprint-outlook',
      severity,
      title: isPositive
        ? 'Iteration is on track'
        : `Iteration completion is ${severity === 'critical' ? 'at risk' : 'uncertain'}`,
      summary: isPositive
        ? `Current completion rate is healthy at ${pred.completionPct}%.`
        : `Current completion rate is ${pred.completionPct}% with a ${pred.probability}% predicted probability.`,
      evidence: `${pred.completedTasks} of ${pred.totalTasks} tasks completed. ${pred.remainingTasks} tasks remain. Confidence: ${pred.confidence.level}.`,
      impact: isPositive
        ? 'Iteration goals are likely to be met.'
        : 'Remaining work may spill over if velocity does not improve.',
      decision: isPositive
        ? 'Maintain current iteration pace.'
        : 'Prioritize remaining iteration-critical work.',
      likelyOutcome: isPositive
        ? 'Iteration completion on schedule.'
        : `Without adjustment, ${pred.remainingTasks} tasks may not complete.`,
      affectedItem: pred.sprintName,
      navigationTarget: { type: 'sprint', tab: 'iterations' },
      isPositive,
    });
  }

  return items;
}

function detectBottleneckSignals(inputs: DecisionTimelineInputs): DecisionTimelineItem[] {
  const items: DecisionTimelineItem[] = [];

  const criticalBottlenecks = inputs.bottlenecks.filter(b => b.severity === 'critical');
  if (criticalBottlenecks.length > 0) {
    const bn = criticalBottlenecks[0];
    items.push({
      id: 'bottleneck-signal-1',
      timestamp: null,
      type: 'delivery-signal',
      severity: 'high',
      title: 'Workflow bottleneck detected',
      summary: `${bn.stage} has ${bn.taskCount} tasks backed up (${bn.percentage}% of total).`,
      evidence: `Stage "${bn.stage}" contains ${bn.taskCount} tasks. This represents ${bn.percentage}% of all tasks, indicating a processing bottleneck.`,
      impact: 'Downstream stages may be starved of work while this bottleneck persists.',
      decision: 'Review capacity at this stage and consider adding resources.',
      likelyOutcome: 'Tasks may accumulate at this stage, delaying overall delivery.',
      affectedItem: bn.stage,
      navigationTarget: { type: 'project', tab: 'work-items' },
      isPositive: false,
    });
  }

  return items;
}

// ============================================================
// MAIN COMPUTATION
// ============================================================

export function computeDecisionTimeline(
  inputs: DecisionTimelineInputs
): DecisionTimelineSnapshot {
  const allItems: DecisionTimelineItem[] = [
    ...detectDeliverySignals(inputs),
    ...detectRiskEscalations(inputs),
    ...detectWorkloadShifts(inputs),
    ...detectQualitySignals(inputs),
    ...detectDependencySignals(inputs),
    ...detectSprintOutlook(inputs),
    ...detectBottleneckSignals(inputs),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const uniqueItems = allItems.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort: severity order, then by timestamp (earliest source date first), positive last
  const sorted = uniqueItems.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return 0;
  });

  // Snapshot
  const activeSignals = sorted.filter(i => !i.isPositive).length;
  const highestSeverity: TimelineSeverity =
    sorted.find(i => !i.isPositive)?.severity ?? 'positive';

  const topAction = sorted.find(i => !i.isPositive);

  return {
    outlook: inputs.outlook,
    activeSignals,
    highestSeverity,
    mostImportantDecision: topAction?.decision ?? 'No immediate decisions required.',
    items: sorted,
  };
}
