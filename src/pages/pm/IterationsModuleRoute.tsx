import React, { useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { matchProject } from '../../utils/idUtils';
import { IterationModuleLayout } from './IterationModuleLayout';
import { IterationsPage } from './IterationsPage';
import { ActiveSprintPage } from './ActiveSprintPage';
import { IterationReportsPage } from './IterationReportsPage';
import { SprintManager } from './SprintManager';

// Route element for every `.../iterations/*` pattern: resolves the project, picks
// the sub-view from the URL tail (default | completed | live-iteration |
// iteration-board | reports) and wraps it in the module layout (breadcrumb header
// + primary nav). The legacy `active-sprint` tail still resolves to the Live
// Iteration page and the legacy `?view=board` query still lands on the Iteration
// Board, so old links keep working.
export const IterationsModuleRoute: React.FC = () => {
  const { projectId, projectKey, projectName } = useParams<{
    projectId?: string;
    projectKey?: string;
    projectName?: string;
  }>();
  const location = useLocation();
  const { projects } = useAppStore();

  const project = useMemo(
    () => projects.find((p) => matchProject(p, { projectId, projectKey, projectName })),
    [projects, projectId, projectKey, projectName]
  );

  const sub = useMemo(() => {
    const seg = location.pathname.replace(/\/+$/, '').split('/').pop() || '';
    if (seg === 'reports') return 'reports';
    if (seg === 'completed') return 'completed';
    if (seg === 'live-iteration' || seg === 'active-sprint') return 'live-iteration';
    if (seg === 'iteration-board') return 'iteration-board';
    return 'default';
  }, [location.pathname]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#747775]">Project not found.</p>
      </div>
    );
  }

  return (
    <IterationModuleLayout project={project}>
      {sub === 'live-iteration' ? (
        <ActiveSprintPage project={project} />
      ) : sub === 'reports' ? (
        <IterationReportsPage project={project} />
      ) : sub === 'iteration-board' ? (
        <IterationBoardView projectId={project.id} />
      ) : sub === 'completed' ? (
        <IterationsPage view="completed" />
      ) : (
        <IterationsPage />
      )}
    </IterationModuleLayout>
  );
};

// The Iteration Board content itself (same board the old `?view=board` switcher
// opened) — rendered without its own header so the primary nav stays the only
// navigation row.
const IterationBoardView: React.FC<{ projectId: string }> = ({ projectId }) => (
  <div className="min-h-0 flex flex-col">
    <div className="flex-1 overflow-y-auto pt-1">
      <SprintManager projectId={projectId} initialSubView="board" embedded />
    </div>
  </div>
);
