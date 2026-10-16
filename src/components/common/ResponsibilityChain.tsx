import React from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Avatar } from './Avatar';
import type { User, WorkflowStage } from '../../types';
import { getRoleLabel } from '../../utils/roleUtils';

interface ChainItem {
  label: string;
  sublabel?: string;
  user?: User;
  isTeam?: boolean;
  teamName?: string;
  isTask?: boolean;
  taskTitle?: string;
  color?: string;
}

interface ResponsibilityChainProps {
  admin?: User;
  projectManager?: User;
  team?: { name: string; color: string };
  teamLeader?: User;
  member?: User;
  taskTitle?: string;
  stage?: WorkflowStage;
  compact?: boolean;
}

const ChainNode: React.FC<{ item: ChainItem; isLast?: boolean; compact?: boolean }> = ({ item, isLast, compact }) => {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex flex-col items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {item.user ? (
          <div className="flex flex-col items-center">
            <Avatar
              name={item.user.name}
              color={item.user.avatarColor}
              size={compact ? 'sm' : 'md'}
            />
            <span className={`font-semibold text-slate-800 text-center mt-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {item.user.name}
            </span>
          </div>
        ) : item.isTeam ? (
          <div
            className={`rounded-xl flex items-center justify-center font-bold text-white ${compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'}`}
            style={{ backgroundColor: item.color || '#2563eb' }}
          >
            {(item.teamName || 'T')[0]}
          </div>
        ) : item.isTask ? (
          <div className={`rounded-xl bg-slate-100 flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-10 h-10'}`}>
            <span className="text-slate-500 text-lg">📋</span>
          </div>
        ) : null}

        <div className="text-center">
          {item.isTeam && (
            <span className={`font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
              {item.teamName}
            </span>
          )}
          {item.isTask && (
            <span className={`font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-sm'} max-w-[120px] truncate block`}>
              {item.taskTitle}
            </span>
          )}
          <span className={`text-slate-500 ${compact ? 'text-xs' : 'text-xs'}`}>{item.label}</span>
        </div>
      </div>

      {!isLast && (
        <div className="flex flex-col items-center my-2">
          <div className="w-px h-5 bg-slate-200" />
          <div className="w-2 h-2 rounded-full border-2 border-slate-300 bg-white" />
          <div className="w-px h-1 bg-slate-200" />
        </div>
      )}
    </div>
  );
};

export const ResponsibilityChain: React.FC<ResponsibilityChainProps> = ({
  admin,
  projectManager,
  team,
  teamLeader,
  member,
  taskTitle,
  compact = false,
}) => {
  const items: { item: ChainItem; show: boolean }[] = [
    {
      show: !!admin,
      item: { label: getRoleLabel('ADMIN'), user: admin },
    },
    {
      show: !!projectManager,
      item: { label: getRoleLabel('PROJECT_MANAGER'), user: projectManager },
    },
    {
      show: !!team,
      item: { label: 'Team', isTeam: true, teamName: team?.name, color: team?.color },
    },
    {
      show: !!teamLeader,
      item: { label: getRoleLabel('TEAM_LEADER'), user: teamLeader },
    },
    {
      show: !!member,
      item: { label: getRoleLabel('MEMBER'), user: member },
    },
    {
      show: !!taskTitle,
      item: { label: 'Task', isTask: true, taskTitle },
    },
  ];

  const visible = items.filter((i) => i.show);

  return (
    <div className={`card ${compact ? 'p-4' : 'p-5'}`}>
      <div className={`flex items-center gap-1.5 mb-4 ${compact ? 'mb-3' : ''}`}>
        <div className="w-1.5 h-4 rounded-full bg-brand-600" />
        <h3 className={`font-semibold text-slate-800 ${compact ? 'text-sm' : 'text-base'}`}>
          Responsibility Chain
        </h3>
      </div>
      <div className="flex flex-col items-center">
        {visible.map((v, i) => (
          <ChainNode
            key={i}
            item={v.item}
            isLast={i === visible.length - 1}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};
