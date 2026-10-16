import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { Avatar } from '../../../components/common/Avatar';
import type { TeamWorkloadMember } from './healthCalculations';

interface WorkloadRiskProps {
  members: TeamWorkloadMember[];
}

const statusConfig = {
  balanced: { label: 'Balanced', color: '#059669', bg: '#d1fae5' },
  busy: { label: 'Busy', color: '#d97706', bg: '#fef3c7' },
  overloaded: { label: 'Overloaded', color: '#dc2626', bg: '#fee2e2' },
};

export const WorkloadRisk: React.FC<WorkloadRiskProps> = ({ members }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <Users className="w-4 h-4 text-[#06b6d4]" />
          Team Workload Risk
        </h2>
        {members.some(m => m.status === 'overloaded') && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#dc2626] bg-[#fee2e2] px-2 py-0.5 rounded-lg">
            <AlertTriangle className="w-3 h-3" />
            Overloaded detected
          </span>
        )}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No active team members</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(member => {
            const cfg = statusConfig[member.status];
            return (
              <div
                key={member.userId}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  member.status === 'overloaded'
                    ? 'bg-[#fef2f2] border border-[#fecaca]'
                    : 'bg-[#f8fafc] border border-[#f1f5f9]'
                }`}
              >
                <Avatar name={member.name} color={member.avatarColor} size="sm" className="w-8 h-8 rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1a1d23] truncate">{member.name}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[#9ca3af]">
                    <span>{member.assignedTasks} assigned</span>
                    <span>{member.completedTasks} done</span>
                    {member.overdueTasks > 0 && (
                      <span className="text-[#dc2626] font-semibold">{member.overdueTasks} overdue</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold" style={{ color: cfg.color }}>
                    {member.workloadPct}%
                  </div>
                  <div className="w-16 h-1.5 bg-[#f1f5f9] rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, member.workloadPct)}%`,
                        backgroundColor: cfg.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
