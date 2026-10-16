/**
 * Calculation safety helpers for frontend computations.
 * Provides guards against NaN, Infinity, negative percentages, and values outside expected ranges.
 */

/**
 * Safely divides two numbers, returning a default value if divisor is 0 or result is not finite.
 */
export function safeDivide(numerator: number, denominator: number, defaultValue: number = 0): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return defaultValue;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : defaultValue;
}

/**
 * Safely calculates a percentage from numerator/denominator, clamped to 0-100.
 */
export function safePercentage(numerator: number, denominator: number, defaultValue: number = 0): number {
  if (denominator === 0) return defaultValue;
  const result = (numerator / denominator) * 100;
  if (!Number.isFinite(result)) return defaultValue;
  return Math.max(0, Math.min(100, Math.round(result)));
}

/**
 * Clamps a number to a valid range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to specified decimal places, returning defaultValue if not finite.
 */
export function safeRound(value: number, decimals: number = 0, defaultValue: number = 0): number {
  if (!Number.isFinite(value)) return defaultValue;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Validates a date string and returns true if it's a valid, parseable date.
 */
export function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Safely formats a date string, returning null if invalid.
 */
export function safeFormatDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculates variance as a percentage-point difference, clamped to reasonable bounds.
 * Returns the difference between actual and expected percentages.
 */
export function calculatePercentageVariance(actualPct: number, expectedPct: number): number {
  if (!Number.isFinite(actualPct) || !Number.isFinite(expectedPct)) return 0;
  const variance = actualPct - expectedPct;
  return clamp(variance, -100, 100);
}

/**
 * Safely calculates workload percentage based on assigned tasks vs max capacity.
 */
export function safeWorkloadPercentage(assignedTasks: number, maxCapacity: number = 5): number {
  if (maxCapacity <= 0 || !Number.isFinite(assignedTasks) || !Number.isFinite(maxCapacity)) return 0;
  return clamp(Math.round((assignedTasks / maxCapacity) * 100), 0, 200);
}

/**
 * Determines workload status based on task count against threshold.
 * Consistent threshold: >4 tasks = overloaded, >2 tasks = busy, else balanced.
 */
export function getWorkloadStatus(taskCount: number): 'balanced' | 'busy' | 'overloaded' {
  if (taskCount > 4) return 'overloaded';
  if (taskCount > 2) return 'busy';
  return 'balanced';
}

/**
 * Consistent overload threshold check.
 * A member is overloaded if they have more than 4 active tasks.
 */
export function isOverloaded(taskCount: number): boolean {
  return taskCount > 4;
}

/**
 * Safely calculates days between two dates, returning 0 if either date is invalid.
 */
export function safeDaysBetween(dateA: string | Date, dateB: string | Date): number {
  const dA = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const dB = typeof dateB === 'string' ? new Date(dateB) : dateB;
  
  if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return 0;
  
  const diffMs = dB.getTime() - dA.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  return Number.isFinite(diffDays) ? diffDays : 0;
}

/**
 * Safely calculates a ratio, returning 0 if denominator is 0 or result is not finite.
 */
export function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}
