import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, Filter, ChevronDown, ChevronRight, Layers, Users,
  Calendar, Package, Target, AlertTriangle, Link2, ShieldAlert, ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatShortDate } from '../../utils/dateUtils';
import { Avatar } from '../../components/common/Avatar';
import { matchId, getProjectUrl, toUrlId } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import type { Task } from '../../types';

type GroupBy = 'none' | 'project' | 'initiative' | 'team' | 'epic' | 'sprint' | 'release' | 'assignee';

interface RoadmapItem {
  id: string;
  name: string;
  type: 'initiative' | 'project' | 'epic' | 'task' | 'sprint' | 'release';
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  color: string;
  projectId: string;
  projectName: string;
  teamId?: string;
  assigneeId?: string;
  sprintId?: string;
  releaseId?: string;
  description?: string;
  children?: RoadmapItem[];
  priority?: string;
  depth: number;
}

const TYPE_COLORS: Record<string, string> = {
  initiative: '#8b5cf6',
  project: '#0d9488',
  epic: '#f59e0b',
  task: '#06b6d4',
  sprint: '#10b981',
  release: '#ec4899',
};

export const CrossProjectRoadmap: React.FC = () => {
  const navigate = useNavigate();
  const { projects, tasks, sprints, releases, users, teams, initiatives, taskDependencies, sprintLinks } = useAppStore();

  const [filterProject, setFilterProject] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [filterInitiative, setFilterInitiative] = useState<string>('');
  const [filterSprint, setFilterSprint] = useState<string>('');
  const [filterRelease, setFilterRelease] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const allRoadmapItems = useMemo((): RoadmapItem[] => {
    const items: RoadmapItem[] = [];

    initiatives.forEach((init) => {
      const project = projects.find((p) => p.id === init.projectId);
      const initEpics = tasks.filter((t) => t.type === 'EPIC' && init.epicIds.includes(t.id));
      const initTasks = tasks.filter((t) => initEpics.some((e) => e.id === t.parentId) || init.epicIds.includes(t.parentId || ''));
      const totalTasks = initTasks.length;
      const doneTasks = initTasks.filter((t) => t.status === 'DONE').length;

      items.push({
        id: init.id,
        name: init.name,
        type: 'initiative',
        startDate: init.startDate || '2024-01-01',
        endDate: init.targetDate || '2024-12-31',
        progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : init.progress,
        status: init.status,
        color: TYPE_COLORS.initiative,
        projectId: init.projectId,
        projectName: project?.name || 'Unknown',
        depth: 0,
        children: initEpics.map((epic) => {
          const epicTasks = tasks.filter((t) => t.parentId === epic.id);
          const epicDone = epicTasks.filter((t) => t.status === 'DONE').length;
          return {
            id: epic.id,
            name: epic.title,
            type: 'epic' as const,
            startDate: epic.startDate || epic.createdAt,
            endDate: epic.dueDate || epic.createdAt,
            progress: epicTasks.length > 0 ? Math.round((epicDone / epicTasks.length) * 100) : 0,
            status: epic.status,
            color: TYPE_COLORS.epic,
            projectId: epic.projectId,
            projectName: project?.name || 'Unknown',
            teamId: epic.teamId,
            assigneeId: epic.assigneeId,
            description: epic.description,
            priority: epic.priority,
            depth: 1,
          };
        }),
      });
    });

    projects.forEach((project) => {
      const projTasks = tasks.filter((t) => t.projectId === project.id);
      const projSprints = sprints.filter((s) => s.projectId === project.id);
      const projReleases = releases.filter((r) => r.projectId === project.id);
      const projEpics = projTasks.filter((t) => t.type === 'EPIC');
      const initIds = initiatives.filter((i) => i.projectId === project.id).map((i) => i.id);

      projEpics.forEach((epic) => {
        if (initIds.length > 0 && initiatives.some((i) => i.epicIds.includes(epic.id))) return;
        const epicTasks = projTasks.filter((t) => t.parentId === epic.id);
        const epicDone = epicTasks.filter((t) => t.status === 'DONE').length;
        items.push({
          id: epic.id,
          name: epic.title,
          type: 'epic',
          startDate: epic.startDate || epic.createdAt,
          endDate: epic.dueDate || epic.createdAt,
          progress: epicTasks.length > 0 ? Math.round((epicDone / epicTasks.length) * 100) : 0,
          status: epic.status,
          color: TYPE_COLORS.epic,
          projectId: project.id,
          projectName: project.name,
          teamId: epic.teamId,
          assigneeId: epic.assigneeId,
          description: epic.description,
          priority: epic.priority,
          depth: 0,
          children: epicTasks.filter((t) => t.type === 'TASK').map((task) => ({
            id: task.id,
            name: task.title,
            type: 'task' as const,
            startDate: task.startDate || task.createdAt,
            endDate: task.dueDate || task.createdAt,
            progress: task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0,
            status: task.status,
            color: task.status === 'DONE' ? '#34a853' : task.status === 'IN_PROGRESS' ? '#1a73e8' : '#747775',
            projectId: project.id,
            projectName: project.name,
            teamId: task.teamId,
            assigneeId: task.assigneeId,
            sprintId: task.sprintId,
            releaseId: task.releaseId,
            description: task.description,
            priority: task.priority,
            depth: 1,
          })),
        });
      });

      projSprints.forEach((sprint) => {
        const sprintTasks = projTasks.filter((t) => t.sprintId === sprint.id);
        const sprintDone = sprintTasks.filter((t) => t.status === 'DONE').length;
        items.push({
          id: sprint.id,
          name: sprint.name,
          type: 'sprint',
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          progress: sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0,
          status: sprint.status,
          color: sprint.status === 'ACTIVE' ? '#1a73e8' : sprint.status === 'COMPLETED' ? '#34a853' : '#747775',
          projectId: project.id,
          projectName: project.name,
          sprintId: sprint.id,
          depth: 0,
        });
      });

      projReleases.forEach((release) => {
        items.push({
          id: release.id,
          name: `${release.name} (${release.version})`,
          type: 'release',
          startDate: release.startDate,
          endDate: release.targetDate,
          progress: release.progress,
          status: release.status,
          color: TYPE_COLORS.release,
          projectId: project.id,
          projectName: project.name,
          releaseId: release.id,
          depth: 0,
        });
      });
    });

    return items;
  }, [projects, tasks, sprints, releases, initiatives]);

  const filteredItems = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      if (filterProject && item.projectId !== filterProject) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterPriority && item.priority !== filterPriority) return false;
      if (filterTeam && item.teamId !== filterTeam) return false;
      if (filterAssignee && item.assigneeId !== filterAssignee) return false;
      if (filterSprint && item.sprintId !== filterSprint) return false;
      if (filterRelease && item.releaseId !== filterRelease) return false;
      if (filterInitiative) {
        const init = initiatives.find((i) => i.id === filterInitiative);
        if (init && item.type !== 'initiative' && !init.epicIds.includes(item.id)) return false;
      }
      return true;
    });
  }, [allRoadmapItems, filterProject, filterTeam, filterInitiative, filterSprint, filterRelease, filterStatus, filterPriority, filterAssignee, initiatives]);

  const groupedItems = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Items', items: filteredItems }];

    const groups = new Map<string, RoadmapItem[]>();
    filteredItems.forEach((item) => {
      let key = '';
      let label = '';
      switch (groupBy) {
        case 'project': key = item.projectId; label = item.projectName; break;
        case 'initiative':
          const init = initiatives.find((i) => i.epicIds.includes(item.id) || i.id === item.id);
          key = init?.id || `unassigned-${item.projectId}`;
          label = init?.name || 'No Initiative';
          break;
        case 'team':
          const team = teams.find((t) => t.id === item.teamId);
          key = item.teamId || `noteam-${item.projectId}`;
          label = team?.name || 'No Team';
          break;
        case 'epic':
          if (item.type === 'epic') { key = item.id; label = item.name; }
          else {
            const parent = tasks.find((t) => t.id === item.id)?.parentId;
            const epic = tasks.find((t) => t.id === parent);
            key = parent || `noepic-${item.projectId}`;
            label = epic?.title || 'No Epic';
          }
          break;
        case 'sprint':
          const sprint = sprints.find((s) => s.id === item.sprintId);
          key = item.sprintId || `nosprint-${item.projectId}`;
          label = sprint?.name || 'No Iteration';
          break;
        case 'release':
          const release = releases.find((r) => r.id === item.releaseId);
          key = item.releaseId || `norelease-${item.projectId}`;
          label = release?.name || 'No Release';
          break;
        case 'assignee':
          const user = users.find((u) => u.id === item.assigneeId);
          key = item.assigneeId || `unassigned-${item.projectId}`;
          label = user?.name || 'Unassigned';
          break;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([key, items]) => ({ key, label: items[0]?.name || key, items }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredItems, groupBy, initiatives, teams, tasks, sprints, releases, users]);

  const allDates = filteredItems.flatMap((item) => [
    new Date(item.startDate).getTime(),
    new Date(item.endDate).getTime(),
  ]);
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  const getPosition = (date: string) => {
    const d = new Date(date).getTime();
    return ((d - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
  };

  const getWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, ((e - s) / (maxDate.getTime() - minDate.getTime())) * 100);
  };

  const toggleGroup = (key: string) => setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleItem = (id: string) => setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const navigateToItem = (item: RoadmapItem) => {
    if (item.type === 'task' || item.type === 'epic') {
      navigate(issuePath(item.id));
    } else {
      const proj = projects.find((p) => matchId(p.id, item.projectId));
      navigate(proj ? getProjectUrl(proj, 'PROJECT_MANAGER') : `/pm/projects/${toUrlId(item.projectId)}`);
    }
  };

  const renderTimelineBar = (item: RoadmapItem, barHeight: string = 'h-5') => (
    <div className="relative w-full">
      <div
        className={`absolute ${barHeight} rounded-md opacity-20`}
        style={{
          left: `${getPosition(item.startDate)}%`,
          width: `${getWidth(item.startDate, item.endDate)}%`,
          backgroundColor: item.color,
        }}
      />
      <div
        className={`absolute ${barHeight} rounded-md`}
        style={{
          left: `${getPosition(item.startDate)}%`,
          width: `${Math.max(getWidth(item.startDate, item.endDate) * (item.progress / 100), 2)}%`,
          backgroundColor: item.color,
        }}
      />
      <div
        className="absolute top-0.5 text-[9px] font-bold text-slate-700 whitespace-nowrap"
        style={{
          left: `calc(${getPosition(item.startDate)}% + ${getWidth(item.startDate, item.endDate) * (item.progress / 100)}% + 4px)`,
        }}
      >
        {item.progress}%
      </div>
    </div>
  );

  const renderCrossProjectDependencies = () => {
    const crossProjectDeps = taskDependencies.filter((dep) => {
      const fromTask = tasks.find((t) => t.id === dep.taskId);
      const toTask = tasks.find((t) => t.id === dep.dependsOnTaskId);
      return fromTask && toTask && fromTask.projectId !== toTask.projectId;
    });

    const crossProjectSprintLinks = sprintLinks.map((link) => {
      const sourceSprint = sprints.find((s) => s.id === link.sourceSprintId);
      const targetSprint = sprints.find((s) => s.id === link.targetSprintId);
      const sourceProj = projects.find((p) => p.id === sourceSprint?.projectId);
      const targetProj = projects.find((p) => p.id === targetSprint?.projectId);
      const isBlocked = link.relationship === 'DEPENDS_ON' && targetSprint?.status !== 'COMPLETED';

      return {
        link,
        sourceSprint,
        targetSprint,
        sourceProj,
        targetProj,
        isBlocked,
      };
    }).filter((item) => item.sourceSprint && item.targetSprint);

    if (crossProjectDeps.length === 0 && crossProjectSprintLinks.length === 0) return null;

    return (
      <div className="card p-4 border-l-4 border-indigo-500 space-y-3">
        {/* Cross-Project Iterations Section */}
        {crossProjectSprintLinks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-900">
                Cross-Project Iteration Dependencies ({crossProjectSprintLinks.length})
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto space-y-1">
              {crossProjectSprintLinks.map(({ link, sourceSprint, targetSprint, sourceProj, targetProj, isBlocked }) => (
                <div key={link.id} className="py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {sourceProj?.name}: {sourceSprint?.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {targetProj?.name}: {targetSprint?.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                      link.relationship === 'DEPENDS_ON'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : link.relationship === 'BLOCKS'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}>
                      {link.relationship.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                        <ShieldAlert className="w-3 h-3" />
                        Prerequisite Incomplete ({targetSprint?.status})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                        Dependency Met
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-Project Tasks Section */}
        {crossProjectDeps.length > 0 && (
          <div className={crossProjectSprintLinks.length > 0 ? 'pt-2 border-t border-slate-100' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-bold text-purple-800">
                Cross-Project Task Dependencies ({crossProjectDeps.length})
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
              {crossProjectDeps.map((dep) => {
                const fromTask = tasks.find((t) => t.id === dep.taskId);
                const toTask = tasks.find((t) => t.id === dep.dependsOnTaskId);
                const fromProject = projects.find((p) => p.id === fromTask?.projectId);
                const toProject = projects.find((p) => p.id === toTask?.projectId);
                return (
                  <div key={dep.id} className="py-1.5 text-xs flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-700 truncate max-w-[140px]">{fromProject?.name}</span>
                    <span className="text-purple-500">→</span>
                    <span className="font-semibold text-slate-700 truncate max-w-[140px]">{toProject?.name}</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-slate-500 truncate">{dep.type.replace(/_/g, ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#1a1d23] flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#0d9488]" /> Cross-Project Roadmap
          </h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Planning view across {projects.filter((p) => !p.isArchived).length} projects, {sprints.length} iterations, {releases.length} releases
          </p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-xs font-bold text-[#4b5563]">Group by:</span>
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="select text-xs py-1.5">
            <option value="none">No Grouping</option>
            <option value="project">Project</option>
            <option value="initiative">Initiative</option>
            <option value="team">Team</option>
            <option value="epic">Epic</option>
            <option value="sprint">Iteration</option>
            <option value="release">Release</option>
            <option value="assignee">Assignee</option>
          </select>

          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Projects</option>
            {projects.filter((p) => !p.isArchived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterInitiative} onChange={(e) => setFilterInitiative(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Initiatives</option>
            {initiatives.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select value={filterSprint} onChange={(e) => setFilterSprint(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Iterations</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterRelease} onChange={(e) => setFilterRelease(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Releases</option>
            {releases.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Status</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DONE">Done</option>
            <option value="TODO">To Do</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="select text-xs py-1.5">
            <option value="">All Assignees</option>
            {users.filter((u) => u.status === 'ACTIVE').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {renderCrossProjectDependencies()}

      <div className="card overflow-hidden">
        <div className="flex border-b border-[#e2e5ea] bg-[#f8fafc]">
          <div className="w-72 flex-shrink-0 p-3 border-r border-[#e2e5ea]">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Item</span>
          </div>
          <div className="flex-1 p-3 overflow-x-auto relative">
            <div className="flex justify-between text-[10px] text-[#9ca3af]">
              {Array.from({ length: Math.min(12, totalDays) }).map((_, i) => {
                const date = new Date(minDate);
                date.setDate(minDate.getDate() + Math.round((i / 11) * totalDays));
                return <span key={i}>{formatShortDate(date.toISOString())}</span>;
              })}
            </div>
            {/* Today Marker */}
            {(() => {
              const today = new Date();
              const todayPos = getPosition(today.toISOString());
              if (todayPos >= 0 && todayPos <= 100) {
                return (
                  <div className="absolute top-0 bottom-0 w-px bg-[#ef4444] z-10" style={{ left: `calc(288px + ${todayPos}% - ${todayPos}% * 288px / 100%)` }}>
                    <div className="absolute -top-1 -left-4 px-1.5 py-0.5 rounded text-[8px] font-bold text-white bg-[#ef4444]">Today</div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {groupedItems.length === 0 || filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No items match the current filters.</p>
            </div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.key}>
                {groupBy !== 'none' && (
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleGroup(group.key)}
                  >
                    {expandedGroups[group.key] === false ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{group.label}</span>
                    <span className="text-[10px] text-slate-400">({group.items.length} items)</span>
                  </div>
                )}

                {(groupBy === 'none' || expandedGroups[group.key] !== false) && group.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                      <div className="w-72 flex-shrink-0 p-3 border-r border-[#f1f5f9] flex items-center gap-2" style={{ paddingLeft: `${12 + item.depth * 16}px` }}>
                        {item.children && item.children.length > 0 && (
                          <button onClick={() => toggleItem(item.id)} className="p-0.5 rounded hover:bg-[#e2e8f0]">
                            {expandedItems[item.id] ? <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />}
                          </button>
                        )}
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="min-w-0 flex-1">
                          <button onClick={() => navigateToItem(item)} className="text-xs font-semibold text-[#1a1d23] hover:text-[#0d9488] truncate block text-left hover:underline">
                            {item.name}
                          </button>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={item.description}>
                              {item.description}
                            </p>
                          )}
                          <div className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                            <span>{item.type}</span>
                            <span>·</span>
                            <span>{item.projectName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 p-3 relative">
                        <div className="relative h-5">{renderTimelineBar(item)}</div>
                      </div>
                    </div>

                    {expandedItems[item.id] && item.children?.map((child) => (
                      <div key={child.id} className="flex border-b border-[#f8fafc] hover:bg-[#fafbfc] bg-[#f8fafc]/50">
                        <div className="w-72 flex-shrink-0 p-3 border-r border-[#f1f5f9] flex items-center gap-2" style={{ paddingLeft: `${28 + child.depth * 16}px` }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                          <div className="min-w-0 flex-1">
                            <button onClick={() => navigateToItem(child)} className="text-[11px] font-medium text-[#4b5563] hover:text-[#0d9488] truncate block text-left hover:underline">
                              {child.name}
                            </button>
                            {child.description && (
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={child.description}>
                                {child.description}
                              </p>
                            )}
                            <div className="text-[10px] text-[#9ca3af]">{child.progress}%</div>
                          </div>
                        </div>
                        <div className="flex-1 p-3 relative">
                          <div className="relative h-4">{renderTimelineBar(child, 'h-4')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#e2e5ea] bg-[#f8fafc] flex items-center gap-4 text-[10px] text-[#9ca3af] flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#8b5cf6]" /><span>Initiative</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#0d9488]" /><span>Project</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#f59e0b]" /><span>Epic</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#06b6d4]" /><span>Iteration</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#ec4899]" /><span>Release</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#10b981]" /><span>Done</span></div>
          <div className="flex items-center gap-1.5"><div className="w-0.5 h-3 bg-[#ef4444]" /><span>Today</span></div>
        </div>
      </div>
    </div>
  );
};
