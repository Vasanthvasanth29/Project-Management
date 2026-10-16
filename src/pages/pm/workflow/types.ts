import type { WorkflowStage, WorkflowTransition, WorkflowTransitionRule } from '../../../types';

export interface StageNodeData {
  stage: WorkflowStage;
  teamName?: string;
  leaderName?: string;
  leaderAvatarColor?: string;
  isSelected?: boolean;
}

export interface StartNodeData {
  label?: string;
  isSelected?: boolean;
}

export interface DoneNodeData {
  label?: string;
  isSelected?: boolean;
}

export interface AnyNodeData {
  label?: string;
  targetStageName?: string;
  isSelected?: boolean;
}

export interface CustomEdgeData {
  transition: WorkflowTransition;
  fromName: string;
  toName: string;
  isSelected?: boolean;
}

export interface DefaultRuleTemplate {
  type: WorkflowTransitionRule['type'];
  title: string;
  description: string;
  defaultConfig?: Record<string, any>;
}

export const DEFAULT_RULES: DefaultRuleTemplate[] = [
  {
    type: 'restrict',
    title: 'Restrict transition',
    description: 'Restrict who can execute this transition by role or team permissions.',
  },
  {
    type: 'request_input',
    title: 'Request input',
    description: 'Prompt users for required fields or resolution notes before moving.',
  },
  {
    type: 'validate',
    title: 'Validate details',
    description: 'Check task requirements, subtasks, or review approvals before moving.',
  },
  {
    type: 'perform_action',
    title: 'Perform actions',
    description: 'Automatically notify team members, update assignees, or trigger events.',
  },
];
