import type { Task, Sprint, Bug, TaskDependency, User } from '../../../types';
import { getCurrentDate } from '../../../utils/dateUtils';
import { safePercentage, clamp, safeDaysBetween, safeRatio, isOverloaded } from '../../../utils/calculationUtils';

// ============================================================
// TYPES
// ============================================================

export type SignalType =
  | 'delivery-risk'
  | 'sprint-completion'
  | 'workload-pressure'
  | 'quality-risk'
  | 'dependency-risk'
  | 'deadline-pressure';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SignalConfidence = 'high' | 'medium' | 'low';
export type ProjectOutlook = 'on-track' | 'watch' | 'at-risk';

export interface ProjectSignal {
  id: string;
  type: SignalType;
  severity: SignalSeverity;
  confidence: SignalConfidence;
  title: string;
  evidence: string;
  likelyOutcome: string;
  prevention: string;
  affectedItem: string;
  navigationTarget: {
    type: 'task' | 'sprint' | 'bug' | 'member' | 'project';
    id?: string;
    tab?: string;
  };
}

export interface ProjectSignalsResult {
  signals: ProjectSignal[];
  outlook: ProjectOutlook;
  outlookReason: string;
}

// ============================================================
// HELPERS
// ============================================================

const getNow = () => getCurrentDate();

function daysBetween(a: string, b: string): number {
  return safeDaysBetween(a, b);
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  return new Date(task.dueDate) < getNow();
}

function daysUntilDue(task: Task): number {
  if (!task.dueDate) return Infinity;
  return Math.round((new Date(task.dueDate).getTime() - getNow().getTime()) / (1000 * 60 * 60 * 24));
}

function computeSignalConfidence(
  evidenceCount: number,
  hasSprintData: boolean,
  hasDependencies: boolean,
): SignalConfidence {
  if (evidenceCount >= 4 && hasSprintData && hasDependencies) return 'high';
  if (evidenceCount >= 2 || hasSprintData) return 'medium';
  return 'low';
}

// ============================================================
// SIGNAL 1: DELIVERY RISK
// ============================================================

function detectDeliveryRisk(
  tasks: Task[],
  sprints: Sprint[],
): ProjectSignal | null {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const overdue = actionable.filter(isOverdue);
  const overdueHigh = overdue.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL');
  const activeTasks = actionable.filter(t => t.status !== 'DONE');
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');

  // Need meaningful data to generate a signal
  if (activeTasks.length === 0) return null;

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'low';
  let confidenceFactors = 0;

  // Evidence: overdue tasks
  if (overdue.length > 0) {
    evidenceParts.push(
      `${overdue.length} of ${activeTasks.length} active tasks are overdue` +
      (overdueHigh.length > 0 ? ` (${overdueHigh.length} high/critical priority)` : '')
    );
    severity = overdueHigh.length > 0 ? 'critical' : overdue.length > 2 ? 'high' : 'medium';
    confidenceFactors++;
  }

  // Evidence: sprint completion risk
  for (const sprint of activeSprints) {
    const sprintTasks = actionable.filter(t => t.sprintId === sprint.id);
    const done = sprintTasks.filter(t => t.status === 'DONE').length;
    const total = sprintTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const daysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));
    const totalDays = daysBetween(sprint.startDate, sprint.endDate);
    const expectedPct = totalDays > 0 ? Math.round(((totalDays - daysLeft) / totalDays) * 100) : 100;

    if (pct < expectedPct - 10 && daysLeft <= 7) {
      evidenceParts.push(
        `Iteration "${sprint.name}" is at ${pct}% completion with ${daysLeft} days remaining (expected ~${expectedPct}%)`
      );
      if (pct < 40) severity = 'critical';
      else if (severity !== 'critical') severity = 'high';
      confidenceFactors++;
    }
  }

  // Evidence: high remaining work ratio
  const remaining = activeTasks.filter(t => t.status !== 'DONE');
  const remainingRatio = actionable.length > 0 ? remaining.length / actionable.length : 0;
  if (remainingRatio > 0.7 && overdue.length > 0) {
    evidenceParts.push(`${Math.round(remainingRatio * 100)}% of project work remains incomplete`);
    if (severity === 'low') severity = 'medium';
    confidenceFactors++;
  }

  if (evidenceParts.length === 0) return null;

  const confidence = computeSignalConfidence(confidenceFactors, activeSprints.length > 0, false);
  const overdueTask = overdueHigh[0] || overdue[0];

  return {
    id: 'signal-delivery-risk',
    type: 'delivery-risk',
    severity,
    confidence,
    title: 'Delivery delay likely',
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      severity === 'critical'
        ? 'Project timeline is at serious risk. Iteration goals may not be met without immediate intervention.'
        : severity === 'high'
          ? 'Iteration completion is at risk. Delivery may slip if patterns continue.'
          : 'Minor delivery risk. Some tasks may become overdue if not addressed.',
    prevention:
      severity === 'critical'
        ? 'Escalate overdue high-priority tasks immediately. Reassign resources and consider reducing iteration scope.'
        : 'Prioritize remaining critical tasks and review blocked work. Consider reassigning overdue items.',
    affectedItem: overdueTask ? overdueTask.title : 'Project delivery',
    navigationTarget: overdueTask
      ? { type: 'task', id: overdueTask.id, tab: 'work-items' }
      : { type: 'project', tab: 'work-items' },
  };
}

// ============================================================
// SIGNAL 2: SPRINT COMPLETION
// ============================================================

function detectSprintCompletion(
  tasks: Task[],
  sprints: Sprint[],
): ProjectSignal | null {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  if (activeSprints.length === 0) return null;

  const sprint = activeSprints[0];
  const sprintTasks = actionable.filter(t => t.sprintId === sprint.id);
  const total = sprintTasks.length;
  if (total === 0) return null;

  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const inProgress = sprintTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const blocked = sprintTasks.filter(t => t.status === 'BLOCKED').length;
  const pct = Math.round((done / total) * 100);

  const daysElapsed = Math.max(1, safeDaysBetween(sprint.startDate, getNow().toISOString()));
  const daysTotal = Math.max(1, safeDaysBetween(sprint.startDate, sprint.endDate));
  const daysLeft = Math.max(0, daysTotal - daysElapsed);
  const velocityPerDay = safeRatio(done, daysElapsed);
  const predictedCompleted = Math.min(total, done + Math.round(velocityPerDay * daysLeft));
  const predictedPct = safePercentage(predictedCompleted, total);
  const expectedPct = safePercentage(daysElapsed, daysTotal);
  const variance = clamp(pct - expectedPct, -100, 100);

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'low';
  let confidenceFactors = 0;

  evidenceParts.push(`${pct}% complete (${done}/${total} tasks done)`);
  evidenceParts.push(`${daysLeft} days remaining in iteration`);
  confidenceFactors++;

  if (variance < -20) {
    evidenceParts.push(`${Math.abs(Math.round(variance))} percentage points behind expected progress at this point`);
    severity = 'critical';
    confidenceFactors++;
  } else if (variance < -10) {
    evidenceParts.push(`${Math.abs(Math.round(variance))} percentage points behind expected schedule`);
    severity = 'high';
    confidenceFactors++;
  } else if (variance < 0) {
    severity = 'medium';
  }

  if (blocked > 0) {
    evidenceParts.push(`${blocked} task${blocked > 1 ? 's' : ''} blocked`);
    if (severity !== 'critical') severity = 'high';
    confidenceFactors++;
  }

  if (inProgress > 0) {
    evidenceParts.push(`${inProgress} task${inProgress > 1 ? 's' : ''} in progress`);
  }

  const confidence = computeSignalConfidence(confidenceFactors, true, false);
  const likelihood = predictedPct >= 90 ? 'likely to finish' : predictedPct >= 60 ? 'at risk' : 'unlikely to finish';

  return {
    id: 'signal-sprint-completion',
    type: 'sprint-completion',
    severity,
    confidence,
    title: `Iteration ${likelihood}`,
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      predictedPct >= 90
        ? `Based on current velocity, the iteration is projected to reach ~${predictedPct}% completion.`
        : predictedPct >= 60
          ? `At current velocity, the iteration may reach only ~${predictedPct}% completion. ${total - predictedCompleted} tasks may remain.`
          : `At current velocity, only ~${predictedPct}% of tasks will be completed. ${total - predictedCompleted} tasks are likely to slip.`,
    prevention:
      blocked > 0
        ? `Resolve ${blocked} blocked task${blocked > 1 ? 's' : ''} to restore progress flow.`
        : predictedPct < 60
          ? `Consider moving ${Math.ceil(total * 0.2)} lower-priority tasks to the next iteration to focus on critical deliverables.`
          : `Monitor velocity and ensure in-progress tasks are completed before iteration end.`,
    affectedItem: sprint.name,
    navigationTarget: { type: 'sprint', id: sprint.id, tab: 'iterations' },
  };
}

// ============================================================
// SIGNAL 3: WORKLOAD PRESSURE
// ============================================================

function detectWorkloadPressure(
  tasks: Task[],
  users: User[],
): ProjectSignal | null {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeTasks = actionable.filter(t => t.status !== 'DONE');
  if (activeTasks.length === 0) return null;

  const memberTaskCounts = new Map<string, number>();
  const memberOverdueCounts = new Map<string, number>();
  const memberHighPrioCounts = new Map<string, number>();

  activeTasks.forEach(t => {
    if (t.assigneeId) {
      memberTaskCounts.set(t.assigneeId, (memberTaskCounts.get(t.assigneeId) || 0) + 1);
      if (isOverdue(t)) {
        memberOverdueCounts.set(t.assigneeId, (memberOverdueCounts.get(t.assigneeId) || 0) + 1);
      }
      if (t.priority === 'HIGH' || t.priority === 'CRITICAL') {
        memberHighPrioCounts.set(t.assigneeId, (memberHighPrioCounts.get(t.assigneeId) || 0) + 1);
      }
    }
  });

  const overloaded = [...memberTaskCounts.entries()].filter(([, count]) => isOverloaded(count));
  if (overloaded.length === 0) return null;

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'medium';
  let confidenceFactors = 0;

  const names = overloaded.map(([uid]) => users.find(u => u.id === uid)?.name || 'Unknown');
  const counts = overloaded.map(([, c]) => c);

  evidenceParts.push(
    `${names.join(', ')} ${overloaded.length > 1 ? 'have' : 'has'} ${counts.join(', ')} active tasks respectively (safe threshold: 4)`
  );
  confidenceFactors++;

  // Check concentration of high-priority work
  const highPrioConcentration = overloaded.reduce((sum, [uid]) => {
    return sum + (memberHighPrioCounts.get(uid) || 0);
  }, 0);
  const totalHighPrio = [...memberHighPrioCounts.values()].reduce((s, c) => s + c, 0);
  if (totalHighPrio > 0 && highPrioConcentration / totalHighPrio > 0.6) {
    evidenceParts.push(
      `Overloaded members handle ${Math.round((highPrioConcentration / totalHighPrio) * 100)}% of high-priority work`
    );
    severity = 'high';
    confidenceFactors++;
  }

  // Check overdue concentration
  const overdueConcentration = overloaded.reduce((sum, [uid]) => {
    return sum + (memberOverdueCounts.get(uid) || 0);
  }, 0);
  if (overdueConcentration > 0) {
    evidenceParts.push(`${overdueConcentration} overdue task${overdueConcentration > 1 ? 's' : ''} among overloaded members`);
    severity = 'high';
    confidenceFactors++;
  }

  // Uneven distribution check
  const counts2 = [...memberTaskCounts.values()].sort((a, b) => b - a);
  if (counts2.length >= 3 && counts2[0] > counts2[Math.floor(counts2.length / 2)] * 2) {
    evidenceParts.push('Workload is unevenly distributed across the team');
    confidenceFactors++;
  }

  const confidence = computeSignalConfidence(confidenceFactors, false, false);
  const mostOverloaded = overloaded[0];
  const mostOverloadedUser = users.find(u => u.id === mostOverloaded[0]);

  return {
    id: 'signal-workload-pressure',
    type: 'workload-pressure',
    severity,
    confidence,
    title: 'Workload pressure may affect delivery',
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      'Workload imbalance may slow delivery and increase risk of missed deadlines for high-priority items.',
    prevention: `Reassign ${Math.min(2, mostOverloaded[1] - 3)} tasks from ${mostOverloadedUser?.name || 'overloaded members'} to team members with available capacity.`,
    affectedItem: mostOverloadedUser?.name || 'Team',
    navigationTarget: { type: 'member', tab: 'team-hub' },
  };
}

// ============================================================
// SIGNAL 4: QUALITY RISK
// ============================================================

function detectQualityRisk(
  bugs: Bug[],
  tasks: Task[],
): ProjectSignal | null {
  const openBugs = bugs.filter(b => b.status !== 'CLOSED');
  const criticalBugs = openBugs.filter(b => b.severity === 'CRITICAL');
  const highBugs = openBugs.filter(b => b.severity === 'HIGH');
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeTasks = actionable.filter(t => t.status !== 'DONE');

  if (openBugs.length === 0) return null;

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'low';
  let confidenceFactors = 0;

  if (criticalBugs.length > 0) {
    evidenceParts.push(`${criticalBugs.length} CRITICAL bug${criticalBugs.length > 1 ? 's' : ''} open`);
    severity = 'critical';
    confidenceFactors++;
  }

  if (highBugs.length > 0) {
    evidenceParts.push(`${highBugs.length} HIGH severity bug${highBugs.length > 1 ? 's' : ''} unresolved`);
    if (severity !== 'critical') severity = 'high';
    confidenceFactors++;
  }

  if (openBugs.length > 2) {
    evidenceParts.push(`${openBugs.length} total open bugs in the project`);
    confidenceFactors++;
  }

  // Bug to task ratio indicator
  if (activeTasks.length > 0) {
    const bugRatio = openBugs.length / activeTasks.length;
    if (bugRatio > 0.3) {
      evidenceParts.push(`Bug density is high: ${Math.round(bugRatio * 100)} open bugs per 100 active tasks`);
      if (severity === 'low') severity = 'medium';
      confidenceFactors++;
    }
  }

  if (evidenceParts.length === 0) return null;

  const confidence = computeSignalConfidence(confidenceFactors, false, false);
  const worstBug = criticalBugs[0] || highBugs[0];

  return {
    id: 'signal-quality-risk',
    type: 'quality-risk',
    severity,
    confidence,
    title: 'Quality risk from unresolved bugs',
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      severity === 'critical'
        ? 'Critical bugs may cause production failures or block release readiness. Unresolved issues compound over time.'
        : 'Open bugs may degrade product quality and slow feature development if not addressed.',
    prevention:
      criticalBugs.length > 0
        ? `Prioritize fixing ${criticalBugs.length} critical bug${criticalBugs.length > 1 ? 's' : ''} before new feature work.`
        : 'Allocate dedicated QA/developer time to resolve high-severity bugs.',
    affectedItem: worstBug ? worstBug.title : 'Project quality',
    navigationTarget: { type: 'bug', id: worstBug?.id, tab: 'work-items' },
  };
}

// ============================================================
// SIGNAL 5: DEPENDENCY RISK
// ============================================================

function detectDependencyRisk(
  tasks: Task[],
  deps: TaskDependency[],
): ProjectSignal | null {
  const blockedByDeps = deps.filter(d => d.type === 'BLOCKED_BY');
  if (blockedByDeps.length === 0) return null;

  const blockedChains: { task: Task; blocker: Task }[] = [];
  blockedByDeps.forEach(dep => {
    const task = tasks.find(t => t.id === dep.taskId);
    const blocker = tasks.find(t => t.id === dep.dependsOnTaskId);
    if (task && blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker))) {
      blockedChains.push({ task, blocker });
    }
  });

  if (blockedChains.length === 0) return null;

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'medium';
  let confidenceFactors = 0;

  evidenceParts.push(
    `${blockedChains.length} task${blockedChains.length > 1 ? 's are' : ' is'} blocked by unresolved dependencies`
  );
  confidenceFactors++;

  // Check if blockers are overdue
  const overdueBlockers = blockedChains.filter(c => isOverdue(c.blocker));
  if (overdueBlockers.length > 0) {
    evidenceParts.push(
      `${overdueBlockers.length} blocking task${overdueBlockers.length > 1 ? 's are' : ' is'} overdue`
    );
    severity = 'high';
    confidenceFactors++;
  }

  // Check cascade depth
  const maxCascade = blockedChains.length;
  if (maxCascade >= 3) {
    evidenceParts.push(`Dependency chain affects ${maxCascade} downstream tasks`);
    severity = 'high';
    confidenceFactors++;
  }

  // Check if blocker is critical priority
  const criticalBlockers = blockedChains.filter(c => c.blocker.priority === 'CRITICAL');
  if (criticalBlockers.length > 0) {
    evidenceParts.push('Blocking task is critical priority');
    severity = 'critical';
    confidenceFactors++;
  }

  const confidence = computeSignalConfidence(confidenceFactors, false, true);
  const firstChain = blockedChains[0];

  return {
    id: 'signal-dependency-risk',
    type: 'dependency-risk',
    severity,
    confidence,
    title: 'Dependency chain blocking progress',
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      severity === 'critical'
        ? 'Critical dependency blockage will cascade delays across multiple tasks and may derail iteration goals.'
        : `Blocked dependencies will prevent ${blockedChains.length} task${blockedChains.length > 1 ? 's' : ''} from progressing, creating downstream delays.`,
    prevention: `Resolve the blocking task "${firstChain.blocker.title}" (${firstChain.blocker.status.toLowerCase().replace('_', ' ')}) to unblock ${blockedChains.length} downstream task${blockedChains.length > 1 ? 's' : ''}.`,
    affectedItem: firstChain.task.title,
    navigationTarget: { type: 'task', id: firstChain.blocker.id, tab: 'work-items' },
  };
}

// ============================================================
// SIGNAL 6: DEADLINE PRESSURE
// ============================================================

function detectDeadlinePressure(
  tasks: Task[],
  sprints: Sprint[],
): ProjectSignal | null {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeTasks = actionable.filter(t => t.status !== 'DONE' && t.dueDate);

  if (activeTasks.length === 0) return null;

  // Tasks due within 7 days
  const dueSoon = activeTasks.filter(t => {
    const days = daysUntilDue(t);
    return days >= 0 && days <= 7;
  });

  // Tasks due in 3 days with low progress
  const urgentTasks = dueSoon.filter(t => {
    const days = daysUntilDue(t);
    const progress = t.status === 'TODO' ? 0 : t.status === 'IN_PROGRESS' ? 50 : 80;
    return days <= 3 && progress < 60;
  });

  if (dueSoon.length === 0) return null;

  const evidenceParts: string[] = [];
  let severity: SignalSeverity = 'low';
  let confidenceFactors = 0;

  evidenceParts.push(
    `${dueSoon.length} task${dueSoon.length > 1 ? 's' : ''} due within the next 7 days`
  );
  confidenceFactors++;

  if (urgentTasks.length > 0) {
    evidenceParts.push(
      `${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} due within 3 days with less than 60% progress`
    );
    severity = urgentTasks.length >= 3 ? 'critical' : 'high';
    confidenceFactors++;
  }

  // Check total remaining work vs deadline
  const remaining = activeTasks.filter(t => t.status !== 'DONE');
  if (remaining.length > 5 && dueSoon.length > remaining.length * 0.4) {
    evidenceParts.push(
      `${Math.round((dueSoon.length / remaining.length) * 100)}% of remaining work is due within 7 days`
    );
    if (severity !== 'critical') severity = 'high';
    confidenceFactors++;
  }

  // Iteration deadline alignment
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  for (const sprint of activeSprints) {
    const sprintDaysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));
    if (sprintDaysLeft <= 5) {
      const sprintTasksDueSoon = dueSoon.filter(t => {
        const task = actionable.find(at => at.id === t.id);
        return task?.sprintId === sprint.id;
      });
      if (sprintTasksDueSoon.length > 0) {
        evidenceParts.push(
          `${sprintTasksDueSoon.length} of these tasks are in "${sprint.name}" which ends in ${sprintDaysLeft} days`
        );
        confidenceFactors++;
      }
    }
  }

  const confidence = computeSignalConfidence(confidenceFactors, activeSprints.length > 0, false);
  const mostUrgent = urgentTasks[0] || dueSoon[0];

  return {
    id: 'signal-deadline-pressure',
    type: 'deadline-pressure',
    severity,
    confidence,
    title: 'Deadline pressure building',
    evidence: evidenceParts.join('. ') + '.',
    likelyOutcome:
      severity === 'critical'
        ? `${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} will become overdue within 3 days without immediate action.`
        : `${dueSoon.length} task${dueSoon.length > 1 ? 's' : ''} approaching deadline may slip if not prioritized.`,
    prevention:
      urgentTasks.length > 0
        ? `Focus on the ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''} due within 3 days. Reassign or escalate as needed.`
        : `Review and prioritize the ${dueSoon.length} tasks due this week to prevent overdue items.`,
    affectedItem: mostUrgent.title,
    navigationTarget: { type: 'task', id: mostUrgent.id, tab: 'work-items' },
  };
}

// ============================================================
// MAIN: COMPUTE ALL SIGNALS
// ============================================================

export function computeProjectSignals(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  deps: TaskDependency[],
  users: User[],
): ProjectSignalsResult {
  const signals: ProjectSignal[] = [];

  const deliveryRisk = detectDeliveryRisk(tasks, sprints);
  if (deliveryRisk) signals.push(deliveryRisk);

  const sprintCompletion = detectSprintCompletion(tasks, sprints);
  if (sprintCompletion) signals.push(sprintCompletion);

  const workloadPressure = detectWorkloadPressure(tasks, users);
  if (workloadPressure) signals.push(workloadPressure);

  const qualityRisk = detectQualityRisk(bugs, tasks);
  if (qualityRisk) signals.push(qualityRisk);

  const dependencyRisk = detectDependencyRisk(tasks, deps);
  if (dependencyRisk) signals.push(dependencyRisk);

  const deadlinePressure = detectDeadlinePressure(tasks, sprints);
  if (deadlinePressure) signals.push(deadlinePressure);

  // Sort by severity then confidence
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  });

  // Compute outlook from strongest signals
  const { outlook, outlookReason } = computeOutlook(signals);

  return { signals, outlook, outlookReason };
}

// ============================================================
// PROJECT OUTLOOK
// ============================================================

function computeOutlook(signals: ProjectSignal[]): { outlook: ProjectOutlook; outlookReason: string } {
  if (signals.length === 0) {
    return {
      outlook: 'on-track',
      outlookReason: 'No predictive signals detected. Current metrics suggest the project is progressing normally.',
    };
  }

  const criticalSignals = signals.filter(s => s.severity === 'critical');
  const highSignals = signals.filter(s => s.severity === 'high');

  if (criticalSignals.length > 0) {
    return {
      outlook: 'at-risk',
      outlookReason: `${criticalSignals.length} critical signal${criticalSignals.length > 1 ? 's' : ''} detected: ${criticalSignals.map(s => s.title).join('; ')}. Immediate attention required.`,
    };
  }

  if (highSignals.length >= 2) {
    return {
      outlook: 'at-risk',
      outlookReason: `${highSignals.length} high-severity signals detected: ${highSignals.map(s => s.title).join('; ')}. Proactive action recommended.`,
    };
  }

  if (highSignals.length === 1) {
    return {
      outlook: 'watch',
      outlookReason: `1 high-severity signal detected: ${highSignals[0].title}. Monitor closely and take preventive action.`,
    };
  }

  return {
    outlook: 'watch',
    outlookReason: 'Minor signals detected. Keep monitoring project metrics.',
  };
}
