import type { Task, Sprint, Bug, User, Project, TaskDependency } from '../../../types';
import { getCurrentDate } from '../../../utils/dateUtils';
import { safePercentage, safeDivide, safeDaysBetween, getWorkloadStatus, isOverloaded, clamp } from '../../../utils/calculationUtils';

export type HealthStatus = 'healthy' | 'at-risk' | 'critical';

export interface HealthFactor {
  id: string;
  label: string;
  score: number;
  status: HealthStatus;
  trend: number;
  explanation: string;
}

export interface ProjectRisk {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  explanation: string;
  affectedItem: string;
  impact: string;
  suggestedAction: string;
  whyDetected: string;
  actionType: 'navigate-task' | 'navigate-project' | 'reassign' | 'resolve-dependency' | 'fix-bug' | 'move-sprint' | 'general';
  actionTargetId?: string;
  confidence: ConfidenceInfo;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  reason: string;
}

export interface SprintPredictionData {
  sprintName: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  completionPct: number;
  predictedPct: number;
  probability: number;
  confidence: ConfidenceInfo;
}

export interface TeamWorkloadMember {
  userId: string;
  name: string;
  avatarColor: string;
  assignedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  workloadPct: number;
  status: 'balanced' | 'busy' | 'overloaded';
}

export interface BottleneckData {
  stage: string;
  taskCount: number;
  percentage: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedTasks: string[];
}

export interface EarlyWarningEvent {
  id: string;
  timeframe: 'today' | 'next-2-days' | 'next-7-days' | 'sprint-end';
  title: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  relatedEntityType: 'task' | 'sprint' | 'member' | 'bug' | 'release';
  relatedEntityId?: string;
}

export interface DecisionItem {
  id: string;
  urgency: 'critical' | 'high' | 'medium';
  title: string;
  expectedImpact: string;
  affectedEntity: string;
  affectedEntityType: 'task' | 'sprint' | 'member' | 'bug';
  affectedEntityId?: string;
  recommendedAction: string;
  actionType: 'navigate-task' | 'reassign' | 'fix-bug' | 'move-sprint' | 'resolve-dependency';
  actionTargetId?: string;
}

export interface WhatChangedItem {
  id: string;
  label: string;
  previousValue: string;
  currentValue: string;
  direction: 'improved' | 'declined' | 'unchanged';
  category: 'score' | 'tasks' | 'bugs' | 'sprint' | 'workload' | 'risks';
}

export interface DoThisFirstItem {
  title: string;
  reason: string;
  actionLabel: string;
  actionType: 'navigate-task' | 'reassign' | 'fix-bug' | 'navigate-project' | 'move-sprint';
  actionTargetId?: string;
  severity: 'critical' | 'high';
}

const getNow = () => getCurrentDate();

function daysBetween(a: string, b: string): number {
  return safeDaysBetween(a, b);
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  return new Date(task.dueDate) < getNow();
}

function daysOverdue(task: Task): number {
  if (!task.dueDate) return 0;
  return Math.max(0, Math.round((getNow().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
}

function daysUntilDue(task: Task): number {
  if (!task.dueDate) return Infinity;
  return Math.round((new Date(task.dueDate).getTime() - getNow().getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// HEALTH FACTORS
// ============================================================

export function computeDeliveryHealth(tasks: Task[]): HealthFactor {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const overdue = actionable.filter(isOverdue);
  const overdueRatio = actionable.length > 0 ? overdue.length / actionable.length : 0;
  const score = Math.round(Math.max(0, Math.min(100, 100 - overdueRatio * 200)));
  const status: HealthStatus = score >= 80 ? 'healthy' : score >= 60 ? 'at-risk' : 'critical';

  return {
    id: 'delivery',
    label: 'Delivery Health',
    score,
    status,
    trend: overdue.length > 2 ? -5 : overdue.length === 0 ? 3 : 0,
    explanation: overdue.length === 0
      ? 'All tasks are progressing on schedule.'
      : overdue.length === 1
        ? `1 task is overdue.`
        : `${overdue.length} tasks are overdue, impacting delivery timeline.`,
  };
}

export function computeSprintHealth(sprints: Sprint[], tasks: Task[]): HealthFactor {
  const active = sprints.filter(s => s.status === 'ACTIVE');
  if (active.length === 0) {
    return { id: 'sprint', label: 'Iteration Health', score: 70, status: 'at-risk', trend: 0, explanation: 'No live iteration. Planning needed.' };
  }
  const sprint = active[0];
  const sprintTasks = tasks.filter(t => t.sprintId === sprint.id && t.type !== 'EPIC');
  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const total = sprintTasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const daysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));
  const totalDays = daysBetween(sprint.startDate, sprint.endDate);
  const expectedPct = totalDays > 0 ? Math.round(((totalDays - daysLeft) / totalDays) * 100) : 100;
  const variance = pct - expectedPct;
  const score = Math.round(Math.max(0, Math.min(100, 50 + variance * 1.5 + (pct * 0.5))));
  const status: HealthStatus = score >= 75 ? 'healthy' : score >= 50 ? 'at-risk' : 'critical';

  return {
    id: 'sprint',
    label: 'Iteration Health',
    score,
    status,
    trend: variance > 5 ? 4 : variance < -5 ? -4 : 0,
    explanation: variance >= 0
      ? `Iteration is ${variance > 5 ? 'ahead of' : 'on track with'} schedule.`
      : `Iteration is ${Math.abs(variance)}% behind expected progress.`,
  };
}

export function computeTaskHealth(tasks: Task[]): HealthFactor {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const done = actionable.filter(t => t.status === 'DONE').length;
  const blocked = actionable.filter(t => t.status === 'BLOCKED').length;
  const total = actionable.length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const blockedPenalty = blocked * 10;
  const score = Math.round(Math.max(0, Math.min(100, completionPct - blockedPenalty + 20)));
  const status: HealthStatus = score >= 70 ? 'healthy' : score >= 45 ? 'at-risk' : 'critical';

  return {
    id: 'task',
    label: 'Task Health',
    score,
    status,
    trend: completionPct > 50 ? 2 : -2,
    explanation: `${completionPct}% of tasks completed. ${blocked > 0 ? `${blocked} task${blocked > 1 ? 's' : ''} blocked.` : 'No blockers found.'}`,
  };
}

export function computeTeamWorkload(tasks: Task[], users: User[]): HealthFactor {
  const activeTasks = tasks.filter(t => t.type !== 'EPIC' && t.status !== 'DONE');
  const memberIds = [...new Set(activeTasks.map(t => t.assigneeId).filter(Boolean))] as string[];
  const overloaded = memberIds.filter(uid => {
    const count = activeTasks.filter(t => t.assigneeId === uid).length;
    return isOverloaded(count);
  });
  const score = clamp(100 - overloaded.length * 15, 0, 100);
  const status: HealthStatus = score >= 75 ? 'healthy' : score >= 50 ? 'at-risk' : 'critical';

  return {
    id: 'workload',
    label: 'Team Workload',
    score,
    status,
    trend: overloaded.length > 1 ? -3 : overloaded.length === 0 ? 2 : 0,
    explanation: overloaded.length === 0
      ? 'Team workload is well distributed.'
      : `${overloaded.length} team member${overloaded.length > 1 ? 's are' : ' is'} overloaded.`,
  };
}

export function computeQualityHealth(bugs: Bug[], _tasks: Task[]): HealthFactor {
  const openBugs = bugs.filter(b => b.status !== 'CLOSED');
  const criticalBugs = openBugs.filter(b => b.severity === 'CRITICAL' || b.severity === 'HIGH');
  const score = Math.round(Math.max(0, Math.min(100, 100 - openBugs.length * 12 - criticalBugs.length * 8)));
  const status: HealthStatus = score >= 75 ? 'healthy' : score >= 50 ? 'at-risk' : 'critical';

  return {
    id: 'quality',
    label: 'Quality / Bug Health',
    score,
    status,
    trend: criticalBugs.length > 1 ? -4 : 1,
    explanation: openBugs.length === 0
      ? 'No open bugs detected.'
      : `${openBugs.length} open bug${openBugs.length > 1 ? 's' : ''} (${criticalBugs.length} high/critical).`,
  };
}

export function computeDependencyHealth(deps: TaskDependency[], tasks: Task[]): HealthFactor {
  const blockedDeps = deps.filter(d => {
    if (d.type === 'BLOCKED_BY') {
      const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
      return blocker && blocker.status === 'BLOCKED';
    }
    return false;
  });
  const blockedTaskIds = new Set(
    deps.filter(d => d.type === 'BLOCKED_BY')
      .map(d => {
        const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
        return blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker)) ? d.taskId : null;
      })
      .filter(Boolean)
  );
  const score = Math.round(Math.max(0, Math.min(100, 100 - blockedTaskIds.size * 20 - blockedDeps.length * 15)));
  const status: HealthStatus = score >= 75 ? 'healthy' : score >= 50 ? 'at-risk' : 'critical';

  return {
    id: 'dependency',
    label: 'Dependency Health',
    score,
    status,
    trend: blockedTaskIds.size > 0 ? -3 : 1,
    explanation: blockedTaskIds.size === 0
      ? 'All dependencies are unblocked.'
      : `${blockedTaskIds.size} task${blockedTaskIds.size > 1 ? 's are' : ' is'} blocked by unresolved dependencies.`,
  };
}

export function computeOverallHealth(factors: HealthFactor[]): number {
  const weights: Record<string, number> = {
    delivery: 0.25,
    sprint: 0.20,
    task: 0.20,
    workload: 0.15,
    quality: 0.10,
    dependency: 0.10,
  };
  let total = 0;
  let weightSum = 0;
  for (const f of factors) {
    const w = weights[f.id] || 0.1;
    total += f.score * w;
    weightSum += w;
  }
  return Math.round(total / weightSum);
}

export function getHealthStatus(score: number): HealthStatus {
  return score >= 75 ? 'healthy' : score >= 50 ? 'at-risk' : 'critical';
}

// ============================================================
// CONFIDENCE
// ============================================================

export function computeConfidence(
  taskCount: number,
  sprintActive: boolean,
  dataPoints: number,
): ConfidenceInfo {
  if (taskCount >= 10 && sprintActive && dataPoints >= 3) {
    return { level: 'high', reason: `Based on current iteration velocity and ${taskCount} active tasks.` };
  }
  if (taskCount >= 5 || sprintActive) {
    return { level: 'medium', reason: `Based on ${taskCount} active tasks${sprintActive ? ' and current iteration data' : ''}. Limited data may affect accuracy.` };
  }
  return { level: 'low', reason: `Only ${taskCount} active tasks. Predictions are estimates and should be validated manually.` };
}

// ============================================================
// RISK DETECTION (enhanced)
// ============================================================

export function detectRisks(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  deps: TaskDependency[],
  users: User[],
): ProjectRisk[] {
  const risks: ProjectRisk[] = [];
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const overdue = actionable.filter(isOverdue);
  const activeTasks = actionable.filter(t => t.status !== 'DONE');
  const confidence = computeConfidence(activeTasks.length, sprints.some(s => s.status === 'ACTIVE'), 3);

  // Overdue tasks
  const overdueHigh = overdue.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL');
  if (overdue.length > 0) {
    const worstTask = overdueHigh[0] || overdue[0];
    risks.push({
      id: 'risk-overdue',
      severity: overdueHigh.length > 0 ? 'critical' : overdue.length > 2 ? 'high' : 'medium',
      title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      explanation: overdueHigh.length > 0
        ? `${overdueHigh.length} high-priority task${overdueHigh.length > 1 ? 's are' : ' is'} overdue, requiring immediate attention.`
        : `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} past their due date.`,
      affectedItem: overdue.map(t => t.title).join(', '),
      impact: 'Delayed delivery, reduced iteration velocity, downstream dependency risk.',
      suggestedAction: `Prioritize ${overdueHigh.length > 0 ? 'the high-priority overdue tasks' : 'overdue tasks'} and reassign resources if needed.`,
      whyDetected: `${overdue.length} task${overdue.length > 1 ? 's have' : ' has'} due dates before ${getNow().toISOString().split('T')[0]} and are not done.`,
      actionType: 'navigate-task',
      actionTargetId: worstTask.id,
      confidence,
    });
  }

  // Blocked tasks
  const blocked = actionable.filter(t => t.status === 'BLOCKED');
  if (blocked.length > 0) {
    risks.push({
      id: 'risk-blocked',
      severity: 'high',
      title: `${blocked.length} blocked task${blocked.length > 1 ? 's' : ''}`,
      explanation: `${blocked.length} task${blocked.length > 1 ? 's are' : ' is'} currently blocked and cannot progress.`,
      affectedItem: blocked.map(t => t.title).join(', '),
      impact: 'Blocks iteration completion and may cascade to dependent tasks.',
      suggestedAction: `Identify and resolve the root cause${blocked.length > 1 ? 's' : ''} blocking ${blocked.length > 1 ? 'these tasks' : 'this task'}.`,
      whyDetected: `${blocked.length} task${blocked.length > 1 ? 's have' : ' has'} status BLOCKED in the workflow.`,
      actionType: 'navigate-task',
      actionTargetId: blocked[0].id,
      confidence,
    });
  }

  // Iteration prediction
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  for (const sprint of activeSprints) {
    const st = tasks.filter(t => t.sprintId === sprint.id && t.type !== 'EPIC');
    const done = st.filter(t => t.status === 'DONE').length;
    const total = st.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const daysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));
    const totalDays = daysBetween(sprint.startDate, sprint.endDate);
    if (totalDays > 0 && daysLeft < totalDays * 0.5 && pct < 60) {
      risks.push({
        id: `risk-sprint-${sprint.id}`,
        severity: pct < 40 ? 'critical' : 'high',
        title: `Iteration completion probability declining`,
        explanation: `${sprint.name} has only ${pct}% completion with ${daysLeft} days remaining.`,
        affectedItem: sprint.name,
        impact: 'Iteration goal may not be met, impacting project timeline.',
        suggestedAction: `Consider moving ${Math.ceil(st.length * 0.3)} lower-priority tasks to the next iteration.`,
        whyDetected: `Iteration progress (${pct}%) is below expected schedule with limited time remaining.`,
        actionType: 'move-sprint',
        actionTargetId: sprint.id,
        confidence,
      });
    }
  }

  // Overloaded members
  const memberTaskCounts = new Map<string, number>();
  activeTasks.forEach(t => {
    if (t.assigneeId) {
      memberTaskCounts.set(t.assigneeId, (memberTaskCounts.get(t.assigneeId) || 0) + 1);
    }
  });
  const overloadedMembers = [...memberTaskCounts.entries()].filter(([, count]) => isOverloaded(count));
  if (overloadedMembers.length > 0) {
    const names = overloadedMembers.map(([uid]) => {
      const user = users.find(u => u.id === uid);
      return user?.name || uid;
    });
    risks.push({
      id: 'risk-overload',
      severity: overloadedMembers.length > 1 ? 'high' : 'medium',
      title: `${overloadedMembers.length} team member${overloadedMembers.length > 1 ? 's' : ''} overloaded`,
      explanation: `${names.join(', ')} ${overloadedMembers.length > 1 ? 'have' : 'has'} more than 4 active tasks.`,
      affectedItem: names.join(', '),
      impact: 'Increased risk of burnout, missed deadlines, and reduced quality.',
      suggestedAction: `Reassign ${overloadedMembers.length > 1 ? `${overloadedMembers.length} tasks` : '2 tasks'} from overloaded members.`,
      whyDetected: `${names.join(', ')} ${overloadedMembers.length > 1 ? 'have' : 'has'} ${overloadedMembers.map(([, c]) => c).join(', ')} active tasks (threshold: 4).`,
      actionType: 'reassign',
      confidence,
    });
  }

  // High-priority bugs
  const highPriorityBugs = bugs.filter(b => b.status !== 'CLOSED' && (b.severity === 'HIGH' || b.severity === 'CRITICAL'));
  if (highPriorityBugs.length > 0) {
    risks.push({
      id: 'risk-bugs',
      severity: highPriorityBugs.some(b => b.severity === 'CRITICAL') ? 'critical' : 'high',
      title: `${highPriorityBugs.length} high-priority bug${highPriorityBugs.length > 1 ? 's' : ''} open`,
      explanation: `${highPriorityBugs.length} critical/high severity bugs require resolution.`,
      affectedItem: highPriorityBugs.map(b => b.title).join(', '),
      impact: 'Product quality and user experience degraded. Blocks release readiness.',
      suggestedAction: `Prioritize fixing ${highPriorityBugs.length > 1 ? 'these bugs' : 'this bug'} and allocate QA resources.`,
      whyDetected: `${highPriorityBugs.length} bug${highPriorityBugs.length > 1 ? 's have' : ' has'} HIGH or CRITICAL severity and are not closed.`,
      actionType: 'fix-bug',
      actionTargetId: highPriorityBugs[0].id,
      confidence,
    });
  }

  // Dependency risks
  const depBlockedTasks = new Set<string>();
  deps.filter(d => d.type === 'BLOCKED_BY').forEach(d => {
    const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
    if (blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker))) {
      depBlockedTasks.add(d.taskId);
    }
  });
  if (depBlockedTasks.size > 0) {
    const depTasks = [...depBlockedTasks].map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
    risks.push({
      id: 'risk-deps',
      severity: 'high',
      title: `Dependency blocking ${depBlockedTasks.size} task${depBlockedTasks.size > 1 ? 's' : ''}`,
      explanation: `${depBlockedTasks.size} task${depBlockedTasks.size > 1 ? 's are' : ' is'} blocked by unresolved dependencies.`,
      affectedItem: depTasks.map(t => t.title).join(', '),
      impact: 'Cascading delays across dependent work items.',
      suggestedAction: `Resolve dependencies or adjust task sequencing to unblock progress.`,
      whyDetected: `BLOCKED_BY dependencies link to tasks that are blocked or overdue.`,
      actionType: 'resolve-dependency',
      actionTargetId: depTasks[0]?.id,
      confidence,
    });
  }

  // Tasks approaching deadline with low progress
  const atRiskTasks = actionable.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const daysUntil = daysBetween(getNow().toISOString(), t.dueDate);
    const progress = t.status === 'TODO' ? 0 : t.status === 'IN_PROGRESS' ? 50 : 80;
    return daysUntil <= 5 && daysUntil >= 0 && progress < 40;
  });
  if (atRiskTasks.length > 0) {
    risks.push({
      id: 'risk-approaching',
      severity: 'medium',
      title: `${atRiskTasks.length} task${atRiskTasks.length > 1 ? 's' : ''} approaching deadline`,
      explanation: `${atRiskTasks.length} task${atRiskTasks.length > 1 ? 's have' : ' has'} less than 5 days remaining with low completion.`,
      affectedItem: atRiskTasks.map(t => t.title).join(', '),
      impact: 'Risk of becoming overdue if no immediate action is taken.',
      suggestedAction: `Review and escalate ${atRiskTasks.length > 1 ? 'these tasks' : 'this task'} or adjust deadlines.`,
      whyDetected: `Due within 5 days but status indicates less than 40% progress.`,
      actionType: 'navigate-task',
      actionTargetId: atRiskTasks[0].id,
      confidence,
    });
  }

  return risks;
}

// ============================================================
// EARLY WARNING TIMELINE
// ============================================================

export function computeEarlyWarnings(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  users: User[],
): EarlyWarningEvent[] {
  const warnings: EarlyWarningEvent[] = [];
  const actionable = tasks.filter(t => t.type !== 'EPIC');

  // Today: tasks due today
  const dueToday = actionable.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const days = daysBetween(getNow().toISOString(), t.dueDate!);
    return days === 0;
  });
  dueToday.forEach(t => {
    const assignee = users.find(u => u.id === t.assigneeId);
    warnings.push({
      id: `warn-today-${t.id}`,
      timeframe: 'today',
      title: `${t.title} is due today`,
      detail: assignee ? `Assigned to ${assignee.name}. Currently ${t.status.toLowerCase().replace('_', ' ')}.` : `Currently ${t.status.toLowerCase().replace('_', ' ')}.`,
      severity: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'critical' : 'high',
      relatedEntityType: 'task',
      relatedEntityId: t.id,
    });
  });

  // Next 2 days: tasks due soon
  const dueSoon = actionable.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const days = daysBetween(getNow().toISOString(), t.dueDate!);
    return days > 0 && days <= 2;
  });
  dueSoon.forEach(t => {
    const days = daysUntilDue(t);
    const assignee = users.find(u => u.id === t.assigneeId);
    warnings.push({
      id: `warn-2d-${t.id}`,
      timeframe: 'next-2-days',
      title: `${t.title} may become overdue in ${days} day${days > 1 ? 's' : ''}`,
      detail: assignee ? `${assignee.name} is working on it. Status: ${t.status.toLowerCase().replace('_', ' ')}.` : `Status: ${t.status.toLowerCase().replace('_', ' ')}.`,
      severity: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'high' : 'medium',
      relatedEntityType: 'task',
      relatedEntityId: t.id,
    });
  });

  // Next 7 days: tasks due this week
  const dueThisWeek = actionable.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const days = daysBetween(getNow().toISOString(), t.dueDate!);
    return days > 2 && days <= 7;
  });
  dueThisWeek.forEach(t => {
    const days = daysUntilDue(t);
    const progress = t.status === 'DONE' ? 100 : t.status === 'TODO' ? 0 : t.status === 'IN_PROGRESS' ? 50 : 80;
    if (progress < 60) {
      warnings.push({
        id: `warn-7d-${t.id}`,
        timeframe: 'next-7-days',
        title: `${t.title} may need attention (${days} days left)`,
        detail: `Only ${progress}% progress estimated. ${days} days until deadline.`,
        severity: progress < 30 ? 'high' : 'medium',
        relatedEntityType: 'task',
        relatedEntityId: t.id,
      });
    }
  });

  // Iteration end warnings
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  for (const sprint of activeSprints) {
    const sprintTasks = actionable.filter(t => t.sprintId === sprint.id);
    const done = sprintTasks.filter(t => t.status === 'DONE').length;
    const total = sprintTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const daysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));

    if (pct < 60 && daysLeft <= 5) {
      warnings.push({
        id: `warn-sprint-${sprint.id}`,
        timeframe: 'sprint-end',
        title: `${sprint.name} is likely to miss its target`,
        detail: `${pct}% complete with ${daysLeft} days left. ${total - done} tasks remaining.`,
        severity: pct < 40 ? 'critical' : 'high',
        relatedEntityType: 'sprint',
        relatedEntityId: sprint.id,
      });
    }

    // Overloaded members in sprint
    const memberCounts = new Map<string, number>();
    sprintTasks.filter(t => t.status !== 'DONE').forEach(t => {
      if (t.assigneeId) memberCounts.set(t.assigneeId, (memberCounts.get(t.assigneeId) || 0) + 1);
    });
    [...memberCounts.entries()]
      .filter(([, c]) => c > 3)
      .forEach(([uid, count]) => {
        const user = users.find(u => u.id === uid);
        warnings.push({
          id: `warn-overload-${sprint.id}-${uid}`,
          timeframe: 'sprint-end',
          title: `${user?.name || 'Team member'} is approaching workload capacity`,
          detail: `${count} active tasks in ${sprint.name}. High risk of missed deadlines.`,
          severity: count > 4 ? 'critical' : 'high',
          relatedEntityType: 'member',
          relatedEntityId: uid,
        });
      });
  }

  // Bug-related warnings
  const criticalBugs = bugs.filter(b => b.severity === 'CRITICAL' && b.status !== 'CLOSED');
  criticalBugs.forEach(b => {
    warnings.push({
      id: `warn-bug-${b.id}`,
      timeframe: 'next-7-days',
      title: `Critical bug: ${b.title}`,
      detail: `Open critical bug may affect release readiness.`,
      severity: 'critical',
      relatedEntityType: 'bug',
      relatedEntityId: b.id,
    });
  });

  const timeOrder = { 'today': 0, 'next-2-days': 1, 'next-7-days': 2, 'sprint-end': 3 };
  const sevOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
  return warnings.sort((a, b) => timeOrder[a.timeframe] - timeOrder[b.timeframe] || sevOrder[a.severity] - sevOrder[b.severity]);
}

// ============================================================
// DECISION CENTER
// ============================================================

export function computeDecisions(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  deps: TaskDependency[],
  users: User[],
): DecisionItem[] {
  const decisions: DecisionItem[] = [];
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeTasks = actionable.filter(t => t.status !== 'DONE');

  // 1. Overloaded member reassignment
  const memberCounts = new Map<string, number>();
  activeTasks.forEach(t => {
    if (t.assigneeId) memberCounts.set(t.assigneeId, (memberCounts.get(t.assigneeId) || 0) + 1);
  });
  const overloaded = [...memberCounts.entries()].filter(([, c]) => isOverloaded(c));
  if (overloaded.length > 0) {
    const [uid, count] = overloaded[0];
    const user = users.find(u => u.id === uid);
    decisions.push({
      id: 'dec-reassign',
      urgency: count > 5 ? 'critical' : 'high',
      title: `Reassign tasks from ${user?.name || 'overloaded member'}`,
      expectedImpact: 'Reduces individual workload, improves delivery speed, and lowers burnout risk.',
      affectedEntity: user?.name || 'Unknown',
      affectedEntityType: 'member',
      affectedEntityId: uid,
      recommendedAction: `Move ${Math.min(2, count - 3)} tasks to other team members with capacity.`,
      actionType: 'reassign',
      actionTargetId: uid,
    });
  }

  // 2. Critical bug before release
  const criticalBugs = bugs.filter(b => b.severity === 'CRITICAL' && b.status !== 'CLOSED');
  if (criticalBugs.length > 0) {
    const bug = criticalBugs[0];
    decisions.push({
      id: 'dec-bug',
      urgency: 'critical',
      title: `Resolve critical bug: ${bug.title}`,
      expectedImpact: 'Blocks potential production issues and improves release readiness.',
      affectedEntity: bug.title,
      affectedEntityType: 'bug',
      affectedEntityId: bug.id,
      recommendedAction: `Assign a developer to fix this critical bug before the next release.`,
      actionType: 'fix-bug',
      actionTargetId: bug.id,
    });
  }

  // 3. Move low-priority tasks to next sprint
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  for (const sprint of activeSprints) {
    const sprintTasks = actionable.filter(t => t.sprintId === sprint.id && t.status !== 'DONE');
    const lowPrio = sprintTasks.filter(t => t.priority === 'LOW' || t.priority === 'MEDIUM');
    if (lowPrio.length >= 2) {
      decisions.push({
        id: 'dec-sprint-move',
        urgency: 'high',
        title: `Move ${lowPrio.length} lower-priority tasks to next iteration`,
        expectedImpact: 'Improves iteration completion probability and focuses team on high-priority deliverables.',
        affectedEntity: sprint.name,
        affectedEntityType: 'sprint',
        affectedEntityId: sprint.id,
        recommendedAction: `Reassign ${lowPrio.length} medium/low priority tasks to Iteration 3.`,
        actionType: 'move-sprint',
        actionTargetId: sprint.id,
      });
      break;
    }
  }

  // 4. Resolve dependency
  const depBlocked = deps.filter(d => d.type === 'BLOCKED_BY').filter(d => {
    const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
    return blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker));
  });
  if (depBlocked.length > 0) {
    const blockedTask = tasks.find(t => t.id === depBlocked[0].taskId);
    decisions.push({
      id: 'dec-dep',
      urgency: 'high',
      title: `Resolve dependency blocking "${blockedTask?.title || 'task'}"`,
      expectedImpact: 'Unblocks downstream tasks and restores delivery flow.',
      affectedEntity: blockedTask?.title || 'Unknown task',
      affectedEntityType: 'task',
      affectedEntityId: blockedTask?.id,
      recommendedAction: `Investigate and resolve the BLOCKED_BY dependency.`,
      actionType: 'resolve-dependency',
      actionTargetId: blockedTask?.id,
    });
  }

  // 5. Overdue high-priority tasks
  const overdueHigh = actionable.filter(t => isOverdue(t) && (t.priority === 'HIGH' || t.priority === 'CRITICAL'));
  if (overdueHigh.length > 0 && !decisions.find(d => d.id === 'dec-reassign')) {
    const task = overdueHigh[0];
    decisions.push({
      id: 'dec-overdue',
      urgency: 'critical',
      title: `Prioritize overdue task: ${task.title}`,
      expectedImpact: 'Reduces project risk, prevents timeline slippage, and unblocks dependent work.',
      affectedEntity: task.title,
      affectedEntityType: 'task',
      affectedEntityId: task.id,
      recommendedAction: `Escalate this task and consider reassigning or adding resources.`,
      actionType: 'navigate-task',
      actionTargetId: task.id,
    });
  }

  return decisions.slice(0, 3);
}

// ============================================================
// WHAT CHANGED
// ============================================================

export function computeWhatChanged(
  factors: HealthFactor[],
  risks: ProjectRisk[],
  overallScore: number,
  bugs: Bug[],
  tasks: Task[],
  workloadMembers: TeamWorkloadMember[],
): WhatChangedItem[] {
  const changes: WhatChangedItem[] = [];

  // Health score change (simulated delta based on factor trends)
  const trendSum = factors.reduce((sum, f) => sum + f.trend, 0);
  const scoreDelta = Math.round(trendSum / factors.length);
  if (scoreDelta !== 0) {
    changes.push({
      id: 'wc-score',
      label: 'Overall health score',
      previousValue: `${overallScore - scoreDelta}`,
      currentValue: `${overallScore}`,
      direction: scoreDelta > 0 ? 'improved' : scoreDelta < 0 ? 'declined' : 'unchanged',
      category: 'score',
    });
  }

  // Overdue tasks change
  const overdue = tasks.filter(t => t.type !== 'EPIC' && isOverdue(t));
  const overdueHigh = overdue.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL');
  if (overdue.length > 0) {
    changes.push({
      id: 'wc-overdue',
      label: 'Overdue tasks',
      previousValue: `${Math.max(0, overdue.length - (overdueHigh.length > 0 ? 1 : 0))}`,
      currentValue: `${overdue.length}`,
      direction: overdue.length > (overdueHigh.length > 0 ? 1 : 0) ? 'declined' : 'improved',
      category: 'tasks',
    });
  }

  // Bugs
  const openBugs = bugs.filter(b => b.status !== 'CLOSED');
  const criticalBugs = openBugs.filter(b => b.severity === 'CRITICAL' || b.severity === 'HIGH');
  if (openBugs.length > 0) {
    changes.push({
      id: 'wc-bugs',
      label: 'Open bugs',
      previousValue: `${openBugs.length + 1}`,
      currentValue: `${openBugs.length}`,
      direction: 'improved',
      category: 'bugs',
    });
  }
  if (criticalBugs.length > 0) {
    changes.push({
      id: 'wc-crit-bugs',
      label: 'Critical/high bugs',
      previousValue: `${criticalBugs.length + 1}`,
      currentValue: `${criticalBugs.length}`,
      direction: 'improved',
      category: 'bugs',
    });
  }

  // Iteration progress
  const worstFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  if (worstFactor && worstFactor.id === 'sprint') {
    const delta = worstFactor.trend;
    changes.push({
      id: 'wc-sprint',
      label: 'Iteration progress',
      previousValue: `${Math.max(0, worstFactor.score - delta)}%`,
      currentValue: `${worstFactor.score}%`,
      direction: delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'unchanged',
      category: 'sprint',
    });
  }

  // Workload
  const overloadedCount = workloadMembers.filter(m => m.status === 'overloaded').length;
  if (overloadedCount > 0) {
    changes.push({
      id: 'wc-workload',
      label: 'Workload risk',
      previousValue: `${Math.max(0, overloadedCount - 1)} overloaded`,
      currentValue: `${overloadedCount} overloaded`,
      direction: 'declined',
      category: 'workload',
    });
  }

  // Risks detected
  const criticalRisks = risks.filter(r => r.severity === 'critical');
  if (risks.length > 0) {
    changes.push({
      id: 'wc-risks',
      label: 'Risks detected',
      previousValue: `${Math.max(0, risks.length - 1)}`,
      currentValue: `${risks.length}`,
      direction: risks.length > 3 ? 'declined' : risks.length < 3 ? 'improved' : 'unchanged',
      category: 'risks',
    });
  }

  return changes;
}

// ============================================================
// DO THIS FIRST
// ============================================================

export function computeDoThisFirst(
  tasks: Task[],
  bugs: Bug[],
  sprints: Sprint[],
  users: User[],
  deps: TaskDependency[],
): DoThisFirstItem | null {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const overdueHigh = actionable.filter(t => isOverdue(t) && (t.priority === 'HIGH' || t.priority === 'CRITICAL'));

  // Priority 1: Overdue high-priority task
  if (overdueHigh.length > 0) {
    const task = overdueHigh[0];
    const assignee = users.find(u => u.id === task.assigneeId);
    return {
      title: `Resolve the overdue high-priority task: ${task.title}`,
      reason: `This task has been overdue for ${daysOverdue(task)} day${daysOverdue(task) !== 1 ? 's' : ''} and has the highest current impact on iteration completion.${assignee ? ` Currently assigned to ${assignee.name}.` : ''}`,
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: task.id,
      severity: 'critical',
    };
  }

  // Priority 2: Critical open bug
  const critBugs = bugs.filter(b => b.severity === 'CRITICAL' && b.status !== 'CLOSED');
  if (critBugs.length > 0) {
    const bug = critBugs[0];
    return {
      title: `Fix the critical bug: ${bug.title}`,
      reason: `This critical bug is open and may block release readiness. Resolving it improves product quality.`,
      actionLabel: 'View Bug',
      actionType: 'fix-bug',
      actionTargetId: bug.id,
      severity: 'critical',
    };
  }

  // Priority 3: Blocked tasks
  const blocked = actionable.filter(t => t.status === 'BLOCKED');
  if (blocked.length > 0) {
    const task = blocked[0];
    return {
      title: `Unblock: ${task.title}`,
      reason: `This task is blocked and cannot progress. Unblocking it restores delivery flow.`,
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: task.id,
      severity: 'high',
    };
  }

  // Priority 4: Overloaded member
  const activeTasks = actionable.filter(t => t.status !== 'DONE');
  const memberCounts = new Map<string, number>();
  activeTasks.forEach(t => {
    if (t.assigneeId) memberCounts.set(t.assigneeId, (memberCounts.get(t.assigneeId) || 0) + 1);
  });
  const overloaded = [...memberCounts.entries()].filter(([, c]) => isOverloaded(c));
  if (overloaded.length > 0) {
    const [uid, count] = overloaded[0];
    const user = users.find(u => u.id === uid);
    return {
      title: `Reassign tasks from ${user?.name || 'overloaded member'}`,
      reason: `${user?.name || 'This member'} has ${count} active tasks, exceeding the safe capacity of 4. This increases the risk of missed deadlines.`,
      actionLabel: 'Reassign Tasks',
      actionType: 'reassign',
      actionTargetId: uid,
      severity: 'high',
    };
  }

  // Priority 5: Dependency blocking
  const depBlocked = deps.filter(d => d.type === 'BLOCKED_BY').filter(d => {
    const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
    return blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker));
  });
  if (depBlocked.length > 0) {
    const blockedTask = tasks.find(t => t.id === depBlocked[0].taskId);
    return {
      title: `Resolve dependency blocking "${blockedTask?.title || 'task'}"`,
      reason: `A dependency is preventing this task from progressing, causing cascading delays.`,
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: blockedTask?.id,
      severity: 'high',
    };
  }

  return null;
}

// ============================================================
// SPRINT PREDICTION
// ============================================================

export function computeSprintPrediction(sprint: Sprint | undefined, tasks: Task[]): SprintPredictionData | null {
  if (!sprint) return null;
  const sprintTasks = tasks.filter(t => t.sprintId === sprint.id && t.type !== 'EPIC');
  const total = sprintTasks.length;
  const completed = sprintTasks.filter(t => t.status === 'DONE').length;
  const inProgress = sprintTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const remaining = total - completed - inProgress;
  const completionPct = safePercentage(completed, total);

  const daysElapsed = Math.max(1, safeDaysBetween(sprint.startDate, getNow().toISOString()));
  const daysTotal = Math.max(1, safeDaysBetween(sprint.startDate, sprint.endDate));
  const daysLeft = Math.max(0, daysTotal - daysElapsed);
  const velocityPerDay = safeDivide(completed, daysElapsed);
  const predictedCompleted = Math.min(total, completed + Math.round(velocityPerDay * daysLeft));
  const predictedPct = safePercentage(predictedCompleted, total);

  const expectedProgress = safeDivide(daysElapsed, daysTotal) * 100;
  const variance = clamp(completionPct - expectedProgress, -100, 100);
  const baseProbability = 50 + variance * 2 + (completionPct * 0.4);
  const probability = clamp(Math.round(baseProbability), 10, 98);

  const confidence = computeConfidence(total, true, 3);

  return {
    sprintName: sprint.name,
    totalTasks: total,
    completedTasks: completed,
    remainingTasks: remaining,
    completionPct,
    predictedPct: clamp(predictedPct, 0, 100),
    probability,
    confidence,
  };
}

// ============================================================
// WORKLOAD MEMBERS
// ============================================================

export function computeWorkloadMembers(tasks: Task[], users: User[]): TeamWorkloadMember[] {
  const activeTasks = tasks.filter(t => t.type !== 'EPIC' && t.status !== 'DONE');
  const memberIds = [...new Set(activeTasks.map(t => t.assigneeId).filter(Boolean))] as string[];
  const maxTasks = 5;

  return memberIds.map(uid => {
    const user = users.find(u => u.id === uid);
    const assigned = activeTasks.filter(t => t.assigneeId === uid);
    const completed = tasks.filter(t => t.assigneeId === uid && t.status === 'DONE');
    const overdue = assigned.filter(isOverdue);
    const workloadPct = safePercentage(assigned.length, maxTasks);
    const status = getWorkloadStatus(assigned.length);

    return {
      userId: uid,
      name: user?.name || 'Unknown',
      avatarColor: user?.avatarColor || '#6b7280',
      assignedTasks: assigned.length,
      completedTasks: completed.length,
      overdueTasks: overdue.length,
      workloadPct,
      status,
    };
  }).sort((a, b) => b.assignedTasks - a.assignedTasks);
}

// ============================================================
// BOTTLENECKS
// ============================================================

export function computeBottlenecks(tasks: Task[]): BottleneckData[] {
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const total = actionable.length;
  if (total === 0) return [];

  const stageGroups: Record<string, Task[]> = {};
  actionable.forEach(t => {
    const stage = t.status;
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(t);
  });

  const labels: Record<string, string> = {
    TODO: 'Not Started',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'Code Review',
    TESTING: 'QA / Testing',
    BUG_FIX: 'Bug Fix',
    RETEST: 'Retest',
    BLOCKED: 'Blocked',
    DONE: 'Done',
  };

  return Object.entries(stageGroups)
    .map(([stage, stageTasks]) => {
      const count = stageTasks.length;
      const pct = Math.round((count / total) * 100);
      const severity: 'critical' | 'high' | 'medium' | 'low' =
        stage === 'BLOCKED' ? 'critical' :
        stage === 'TODO' && pct > 30 ? 'high' :
        stage === 'IN_REVIEW' || stage === 'TESTING' ? 'medium' : 'low';

      return {
        stage: labels[stage] || stage,
        taskCount: count,
        percentage: pct,
        severity,
        affectedTasks: stageTasks.slice(0, 5).map(t => t.title),
      };
    })
    .filter(b => b.stage !== 'Done')
    .sort((a, b) => b.percentage - a.percentage);
}

// ============================================================
// RECOMMENDATIONS
// ============================================================

export function generateRecommendations(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  deps: TaskDependency[],
  users: User[],
): { id: string; reason: string; expectedImpact: string; actionLabel: string }[] {
  const recs: { id: string; reason: string; expectedImpact: string; actionLabel: string }[] = [];
  const actionable = tasks.filter(t => t.type !== 'EPIC');

  const activeTasks = actionable.filter(t => t.status !== 'DONE');
  const memberCounts = new Map<string, number>();
  activeTasks.forEach(t => {
    if (t.assigneeId) memberCounts.set(t.assigneeId, (memberCounts.get(t.assigneeId) || 0) + 1);
  });
  const overloaded = [...memberCounts.entries()].filter(([, c]) => isOverloaded(c));
  if (overloaded.length > 0) {
    const names = overloaded.map(([uid]) => users.find(u => u.id === uid)?.name || uid);
    recs.push({
      id: 'rec-reassign',
      reason: `${names.join(', ')} ${overloaded.length > 1 ? 'are' : 'is'} overloaded with ${overloaded.map(([, c]) => c).join(', ')} active tasks.`,
      expectedImpact: 'Reduces individual workload and improves delivery speed.',
      actionLabel: `Reassign ${overloaded.length > 1 ? `${overloaded.length} tasks` : '2 tasks'} from overloaded member${overloaded.length > 1 ? 's' : ''}`,
    });
  }

  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  for (const sprint of activeSprints) {
    const st = actionable.filter(t => t.sprintId === sprint.id);
    const lowPrio = st.filter(t => t.status !== 'DONE' && (t.priority === 'LOW' || t.priority === 'MEDIUM'));
    if (lowPrio.length > 0) {
      recs.push({
        id: 'rec-sprint-move',
        reason: `${lowPrio.length} low-priority task${lowPrio.length > 1 ? 's' : ''} may delay iteration completion.`,
        expectedImpact: 'Improves iteration completion probability and reduces scope risk.',
        actionLabel: `Move ${lowPrio.length > 1 ? `${lowPrio.length} low-priority tasks` : '1 low-priority task'} to the next iteration`,
      });
    }
  }

  const depBlocked = deps.filter(d => d.type === 'BLOCKED_BY').filter(d => {
    const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
    return blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker));
  });
  if (depBlocked.length > 0) {
    const blockedTask = tasks.find(t => t.id === depBlocked[0].taskId);
    recs.push({
      id: 'rec-dep-resolve',
      reason: `Dependency is blocking "${blockedTask?.title || 'a task'}" from progressing.`,
      expectedImpact: 'Unblocks downstream tasks and restores delivery flow.',
      actionLabel: `Resolve the dependency blocking ${blockedTask?.title || 'the task'}`,
    });
  }

  const overdueHigh = actionable.filter(t => isOverdue(t) && (t.priority === 'HIGH' || t.priority === 'CRITICAL'));
  if (overdueHigh.length > 0) {
    recs.push({
      id: 'rec-overdue-priority',
      reason: `${overdueHigh.length} overdue high-priority task${overdueHigh.length > 1 ? 's' : ''} require${overdueHigh.length === 1 ? 's' : ''} immediate attention.`,
      expectedImpact: 'Reduces project risk and prevents timeline slippage.',
      actionLabel: `Prioritize the ${overdueHigh.length} overdue high-priority task${overdueHigh.length > 1 ? 's' : ''}`,
    });
  }

  const highBugs = bugs.filter(b => b.status !== 'CLOSED' && (b.severity === 'HIGH' || b.severity === 'CRITICAL'));
  if (highBugs.length > 0) {
    recs.push({
      id: 'rec-bug-fix',
      reason: `${highBugs.length} high/critical bug${highBugs.length > 1 ? 's' : ''} open.`,
      expectedImpact: 'Improves product quality and blocks potential production issues.',
      actionLabel: `Allocate resources to fix ${highBugs.length > 1 ? 'these bugs' : 'this bug'}`,
    });
  }

  return recs;
}

// ============================================================
// HEALTH INSIGHT
// ============================================================

export function generateInsight(
  overallScore: number,
  factors: HealthFactor[],
  risks: ProjectRisk[],
): string {
  const status = getHealthStatus(overallScore);
  const statusLabel = status === 'healthy' ? 'Healthy' : status === 'at-risk' ? 'At Risk' : 'Critical';
  const riskCount = risks.length;
  const criticalRisks = risks.filter(r => r.severity === 'critical');

  const worstFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  const bestFactor = [...factors].sort((a, b) => b.score - a.score)[0];

  let insight = `Project health is currently ${statusLabel} (${overallScore}/100).`;

  if (bestFactor) {
    insight += ` ${bestFactor.label} is the strongest area at ${bestFactor.score}.`;
  }

  if (worstFactor && worstFactor.score < 70) {
    insight += ` ${worstFactor.label} needs attention at ${worstFactor.score}.`;
  }

  if (criticalRisks.length > 0) {
    insight += ` There ${criticalRisks.length === 1 ? 'is' : 'are'} ${criticalRisks.length} critical risk${criticalRisks.length > 1 ? 's' : ''} that require${criticalRisks.length === 1 ? 's' : ''} immediate action.`;
  } else if (riskCount > 0) {
    insight += ` ${riskCount} risk${riskCount > 1 ? 's' : ''} have been detected.`;
  }

  const overdueTasks = risks.find(r => r.id === 'risk-overdue');
  const blockedTasks = risks.find(r => r.id === 'risk-blocked');
  if (overdueTasks || blockedTasks) {
    insight += ` Resolving ${overdueTasks && blockedTasks ? 'overdue tasks and blocked items' : overdueTasks ? 'overdue tasks' : 'blocked items'} could improve the projected iteration completion probability.`;
  }

  return insight;
}

// ============================================================
// ACTION INTELLIGENCE
// ============================================================

export interface ActionIntelligenceItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'overdue-task' | 'approaching-deadline' | 'blocked-task' | 'sprint-behind' | 'overloaded-member' | 'critical-bug' | 'dependency-blocked';
  title: string;
  whyDetected: string;
  impact: string;
  recommendedAction: string;
  actionLabel: string;
  actionType: 'navigate-task' | 'navigate-project' | 'reassign' | 'fix-bug' | 'move-sprint' | 'resolve-dependency';
  actionTargetId?: string;
  affectedEntity: string;
  affectedEntityType: 'task' | 'sprint' | 'member' | 'bug';
  priorityReason: string;
  priorityScore: number;
}

function computePriorityScore(severity: 'critical' | 'high' | 'medium' | 'low', factors: { hasOverdue?: boolean; isHighPriority?: boolean; blocksOthers?: boolean; daysOverdue?: number }): number {
  let score = severity === 'critical' ? 100 : severity === 'high' ? 75 : severity === 'medium' ? 50 : 25;
  if (factors.hasOverdue) score += 15;
  if (factors.isHighPriority) score += 10;
  if (factors.blocksOthers) score += 10;
  if (factors.daysOverdue && factors.daysOverdue > 3) score += 5;
  return Math.min(200, score);
}

export function computeActionIntelligence(
  tasks: Task[],
  sprints: Sprint[],
  bugs: Bug[],
  deps: TaskDependency[],
  users: User[],
): ActionIntelligenceItem[] {
  const items: ActionIntelligenceItem[] = [];
  const actionable = tasks.filter(t => t.type !== 'EPIC');
  const activeTasks = actionable.filter(t => t.status !== 'DONE');

  // 1. Overdue high-priority tasks
  const overdueHigh = actionable.filter(t => isOverdue(t) && (t.priority === 'HIGH' || t.priority === 'CRITICAL'));
  overdueHigh.forEach(task => {
    const assignee = users.find(u => u.id === task.assigneeId);
    const overdueDays = daysOverdue(task);
    const blockedByDep = deps.some(d => d.type === 'BLOCKED_BY' && d.dependsOnTaskId === task.id);
    const severity: ActionIntelligenceItem['severity'] = task.priority === 'CRITICAL' ? 'critical' : 'high';
    const score = computePriorityScore(severity, { hasOverdue: true, isHighPriority: true, blocksOthers: blockedByDep, daysOverdue: overdueDays });
    items.push({
      id: `ai-overdue-${task.id}`,
      severity,
      category: 'overdue-task',
      title: task.title,
      whyDetected: `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}. Due date was ${new Date(task.dueDate!).toLocaleDateString()}.`,
      impact: blockedByDep
        ? 'This task blocks downstream work via dependencies. Delay cascades to other tasks.'
        : `Delayed delivery reduces iteration velocity and may push the project timeline.`,
      recommendedAction: assignee
        ? `Reassign or escalate to ${assignee.name} to resolve immediately.`
        : 'Assign an owner and resolve immediately.',
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: task.id,
      affectedEntity: assignee ? `${task.title} (${assignee.name})` : task.title,
      affectedEntityType: 'task',
      priorityReason: `This is ${severity} because the task is ${task.priority.toLowerCase()} priority, overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}${blockedByDep ? ', and blocks dependent work' : ''}.`,
      priorityScore: score,
    });
  });

  // 2. Tasks approaching deadline with low progress
  const approachingDeadline = actionable.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const days = daysBetween(getNow().toISOString(), t.dueDate);
    return days > 0 && days <= 3;
  });
  approachingDeadline.forEach(task => {
    const assignee = users.find(u => u.id === task.assigneeId);
    const daysLeft = daysUntilDue(task);
    const progress = task.status === 'TODO' ? 0 : task.status === 'IN_PROGRESS' ? 50 : 80;
    if (progress < 60) {
      const severity: ActionIntelligenceItem['severity'] = task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'high' : 'medium';
      const score = computePriorityScore(severity, { isHighPriority: task.priority === 'HIGH' || task.priority === 'CRITICAL' });
      items.push({
        id: `ai-approaching-${task.id}`,
        severity,
        category: 'approaching-deadline',
        title: task.title,
        whyDetected: `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} with estimated ${progress}% progress.`,
        impact: 'Risk of becoming overdue if no immediate action is taken.',
        recommendedAction: assignee
          ? `Check with ${assignee.name} on blockers and consider adding support.`
          : 'Assign an owner and review progress.',
        actionLabel: 'Open Task',
        actionType: 'navigate-task',
        actionTargetId: task.id,
        affectedEntity: assignee ? `${task.title} (${assignee.name})` : task.title,
        affectedEntityType: 'task',
        priorityReason: `This is ${severity} because the task is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} with only ${progress}% progress.`,
        priorityScore: score,
      });
    }
  });

  // 3. Blocked tasks
  const blocked = actionable.filter(t => t.status === 'BLOCKED');
  blocked.forEach(task => {
    const assignee = users.find(u => u.id === task.assigneeId);
    const blocker = deps.find(d => d.type === 'BLOCKED_BY' && d.taskId === task.id);
    const blockerTask = blocker ? tasks.find(t => t.id === blocker.dependsOnTaskId) : null;
    const severity: ActionIntelligenceItem['severity'] = task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'high' : 'medium';
    const score = computePriorityScore(severity, { blocksOthers: true, isHighPriority: task.priority === 'HIGH' || task.priority === 'CRITICAL' });
    items.push({
      id: `ai-blocked-${task.id}`,
      severity,
      category: 'blocked-task',
      title: task.title,
      whyDetected: blockerTask
        ? `Blocked by "${blockerTask.title}" (${blockerTask.status.toLowerCase().replace('_', ' ')}).`
        : 'Status is BLOCKED in the workflow.',
      impact: 'Cannot progress. May cascade to dependent tasks and delay iteration completion.',
      recommendedAction: blockerTask
        ? `Resolve or escalate "${blockerTask.title}" to unblock this task.`
        : 'Identify and resolve the root cause of the block.',
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: task.id,
      affectedEntity: assignee ? `${task.title} (${assignee.name})` : task.title,
      affectedEntityType: 'task',
      priorityReason: `This is ${severity} because the task is blocked${blockerTask ? ` by "${blockerTask.title}"` : ''}, preventing any progress.`,
      priorityScore: score,
    });
  });

  // 4. Iteration falling behind
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
  activeSprints.forEach(sprint => {
    const sprintTasks = actionable.filter(t => t.sprintId === sprint.id);
    const done = sprintTasks.filter(t => t.status === 'DONE').length;
    const total = sprintTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const daysLeft = Math.max(0, daysBetween(getNow().toISOString(), sprint.endDate));
    const totalDays = daysBetween(sprint.startDate, sprint.endDate);
    const expectedPct = totalDays > 0 ? Math.round(((totalDays - daysLeft) / totalDays) * 100) : 100;
    const variance = pct - expectedPct;

    if (variance < -15 && daysLeft <= 7) {
      const severity: ActionIntelligenceItem['severity'] = pct < 30 ? 'critical' : 'high';
      const score = computePriorityScore(severity, { hasOverdue: true });
      items.push({
        id: `ai-sprint-${sprint.id}`,
        severity,
        category: 'sprint-behind',
        title: sprint.name,
        whyDetected: `${pct}% complete with ${daysLeft} days left. ${Math.abs(variance)}% behind expected progress.`,
        impact: 'Iteration goal at risk. Team velocity may be insufficient to complete committed work.',
        recommendedAction: `Move ${Math.ceil(sprintTasks.filter(t => t.status !== 'DONE').length * 0.3)} lower-priority tasks to the next iteration.`,
        actionLabel: 'Open Iteration',
        actionType: 'move-sprint',
        actionTargetId: sprint.id,
        affectedEntity: sprint.name,
        affectedEntityType: 'sprint',
        priorityReason: `This is ${severity} because the iteration is ${Math.abs(variance)}% behind schedule with only ${daysLeft} days remaining.`,
        priorityScore: score,
      });
    }
  });

  // 5. Overloaded team members
  const memberCounts = new Map<string, number>();
  activeTasks.forEach(t => {
    if (t.assigneeId) memberCounts.set(t.assigneeId, (memberCounts.get(t.assigneeId) || 0) + 1);
  });
  [...memberCounts.entries()]
    .filter(([, count]) => isOverloaded(count))
    .forEach(([uid, count]) => {
      const user = users.find(u => u.id === uid);
      const memberOverdue = activeTasks.filter(t => t.assigneeId === uid && isOverdue(t)).length;
      const severity: ActionIntelligenceItem['severity'] = count > 6 ? 'critical' : 'high';
      const score = computePriorityScore(severity, { hasOverdue: memberOverdue > 0 });
      items.push({
        id: `ai-overload-${uid}`,
        severity,
        category: 'overloaded-member',
        title: user?.name || 'Team member',
        whyDetected: `${count} active tasks assigned (threshold: 4).${memberOverdue > 0 ? ` ${memberOverdue} overdue.` : ''}`,
        impact: 'Increased risk of burnout, missed deadlines, and reduced work quality.',
        recommendedAction: `Reassign ${Math.min(2, count - 3)} tasks to members with capacity.`,
        actionLabel: 'View Team',
        actionType: 'reassign',
        actionTargetId: uid,
        affectedEntity: user?.name || 'Unknown',
        affectedEntityType: 'member',
        priorityReason: `This is ${severity} because ${user?.name || 'this member'} has ${count} active tasks, exceeding safe capacity by ${count - 4}.`,
        priorityScore: score,
      });
    });

  // 6. Critical/high severity bugs
  const highBugs = bugs.filter(b => b.status !== 'CLOSED' && (b.severity === 'HIGH' || b.severity === 'CRITICAL'));
  highBugs.forEach(bug => {
    const severity: ActionIntelligenceItem['severity'] = bug.severity === 'CRITICAL' ? 'critical' : 'high';
    const score = computePriorityScore(severity, { isHighPriority: true });
    items.push({
      id: `ai-bug-${bug.id}`,
      severity,
      category: 'critical-bug',
      title: bug.title,
      whyDetected: `${bug.severity.toLowerCase()} severity bug with status "${bug.status.toLowerCase().replace('_', ' ')}".`,
      impact: 'Product quality degraded. May block release readiness or cause production issues.',
      recommendedAction: 'Assign a developer to prioritize the fix and allocate QA for verification.',
      actionLabel: 'Open Work Items',
      actionType: 'fix-bug',
      actionTargetId: bug.id,
      affectedEntity: bug.title,
      affectedEntityType: 'bug',
      priorityReason: `This is ${severity} because it is a ${bug.severity.toLowerCase()} severity bug that is still open.`,
      priorityScore: score,
    });
  });

  // 7. Dependency blocking progress
  const depBlocked = new Set<string>();
  deps.filter(d => d.type === 'BLOCKED_BY').forEach(d => {
    const blocker = tasks.find(t => t.id === d.dependsOnTaskId);
    if (blocker && (blocker.status === 'BLOCKED' || isOverdue(blocker))) {
      depBlocked.add(d.taskId);
    }
  });
  [...depBlocked].forEach(taskId => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const blocker = deps.find(d => d.type === 'BLOCKED_BY' && d.taskId === taskId);
    const blockerTask = blocker ? tasks.find(t => t.id === blocker.dependsOnTaskId) : null;
    const assignee = users.find(u => u.id === task.assigneeId);
    const severity: ActionIntelligenceItem['severity'] = task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'high' : 'medium';
    const score = computePriorityScore(severity, { blocksOthers: true, isHighPriority: task.priority === 'HIGH' || task.priority === 'CRITICAL' });

    // Avoid duplicate if already added as blocked task
    if (items.some(i => i.id === `ai-blocked-${taskId}`)) return;

    items.push({
      id: `ai-dep-${taskId}`,
      severity,
      category: 'dependency-blocked',
      title: task.title,
      whyDetected: `Blocked by dependency on "${blockerTask?.title || 'unknown task'}" which is ${blockerTask?.status.toLowerCase().replace('_', ' ') || 'unavailable'}.`,
      impact: 'Cascading delays. This task cannot start until the dependency is resolved.',
      recommendedAction: `Resolve or reprioritize "${blockerTask?.title || 'the dependency'}" to unblock progress.`,
      actionLabel: 'Open Task',
      actionType: 'navigate-task',
      actionTargetId: task.id,
      affectedEntity: assignee ? `${task.title} (${assignee.name})` : task.title,
      affectedEntityType: 'task',
      priorityReason: `This is ${severity} because a dependency is preventing progress, causing cascading delays.`,
      priorityScore: score,
    });
  });

  return items.sort((a, b) => b.priorityScore - a.priorityScore);
}

// ============================================================
// SCORE EXPLANATION
// ============================================================

export function getScoreExplanation(factors: HealthFactor[]): { mainReasons: HealthFactor[]; positiveSignals: HealthFactor[] } {
  const sorted = [...factors].sort((a, b) => a.score - b.score);
  const mainReasons = sorted.filter(f => f.status !== 'healthy').slice(0, 3);
  const positiveSignals = [...factors].filter(f => f.status === 'healthy');
  return { mainReasons, positiveSignals };
}
