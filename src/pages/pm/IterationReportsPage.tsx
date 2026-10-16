import React from 'react';
import type { Project } from '../../types';
import { ReportsPage } from './reports/ReportsPage';

interface IterationReportsPageProps {
  project: Project;
}

export const IterationReportsPage: React.FC<IterationReportsPageProps> = ({ project }) => {
  return (
    <div className="flex-1 min-w-0 pt-1 flex flex-col">
      <div className="flex-shrink-0 pb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#1f1f1f]">Iteration Reports</h2>
          <p className="text-xs text-[#6b778c] mt-0.5 truncate">
            {project.name} · iteration summary, progress, burndown, velocity and workload
          </p>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <ReportsPage projectId={project.id} />
      </div>
    </div>
  );
};
