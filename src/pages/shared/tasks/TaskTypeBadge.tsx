import React from 'react';
import { Layers, CornerDownRight, Compass, Blocks } from 'lucide-react';
import type { Task } from '../../../types';
import { getWorkItemLabel } from '../../../utils/workItemHierarchy';
import { StoryTaskIcon } from '../../../components/common/StoryTaskIcon';
import { StoryIcon } from '../../../components/common/StoryIcon';
import { BugIssueIcon } from '../../../components/common/BugIssueIcon';

interface TaskTypeBadgeProps {
  type: Task['type'];
  className?: string;
  showIconOnly?: boolean;
  /** Render the label as plain dark text (no coloured pill / icon) */
  plain?: boolean;
}

const STYLES: Record<string, { className: string; icon: React.ReactNode; title: string }> = {
  INITIATIVE: {
    className: 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]',
    icon: <Compass className="w-3 h-3 text-[#b45309] flex-shrink-0" />,
    title: 'Initiative (Top-level planning item)',
  },
  FEATURE: {
    className: 'bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]',
    icon: <Blocks className="w-3 h-3 text-[#0d9488] flex-shrink-0" />,
    title: 'Feature (Owned by an Initiative)',
  },
  EPIC: {
    className: 'bg-[#f3e8ff] text-[#7c3aed] border border-[#e9d5ff]',
    icon: <Layers className="w-3 h-3 text-[#7c3aed] flex-shrink-0" />,
    title: 'Epic (Owned by a Feature)',
  },
  STORY: {
    className: 'bg-[#d1fae5] text-[#047857] border border-[#a7f3d0]',
    icon: <StoryIcon className="w-3 h-3 flex-shrink-0" />,
    title: 'Story (Delivery work under an Epic)',
  },
  'SUB-TASK': {
    className: 'bg-[#ecfeff] text-[#0891b2] border border-[#cffafe]',
    icon: <CornerDownRight className="w-3 h-3 text-[#0891b2] flex-shrink-0" />,
    title: 'Sub-task (Child item of a Task)',
  },
  SUBTASK: {
    className: 'bg-[#ecfeff] text-[#0891b2] border border-[#cffafe]',
    icon: <CornerDownRight className="w-3 h-3 text-[#0891b2] flex-shrink-0" />,
    title: 'Sub-task (Child item of a Task)',
  },
  BUG: {
    className: 'bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]',
    icon: <BugIssueIcon className="w-3 h-3 flex-shrink-0" />,
    title: 'Bug',
  },
  'BUG-FIX': {
    className: 'bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]',
    icon: <BugIssueIcon className="w-3 h-3 flex-shrink-0" />,
    title: 'Bug Fix',
  },
  TASK: {
    className: 'bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]',
    icon: <StoryTaskIcon className="w-3 h-3 flex-shrink-0" />,
    title: 'Task (Standard work item)',
  },
};

export const TaskTypeBadge: React.FC<TaskTypeBadgeProps> = ({ type, className = '', showIconOnly = false, plain = false }) => {
  const normType = String(type).toUpperCase().replace(/_/g, '-');
  const style = STYLES[normType] || STYLES.TASK;

  if (plain) {
    return (
      <span
        className={`inline-flex items-center text-[10px] font-bold tracking-wider text-slate-700 ${className}`}
        title={style.title}
      >
        {getWorkItemLabel(type)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${style.className} ${className}`}
      title={style.title}
    >
      {style.icon}
      {!showIconOnly && <span>{showIconOnly ? '' : getWorkItemLabel(type)}</span>}
    </span>
  );
};
