import React, { useMemo, useState } from 'react';
import { GitBranch, Calendar, ChevronDown, ChevronRight, Filter, Layers } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { formatDate, formatShortDate } from '../../../utils/dateUtils';
import { Avatar } from '../../../components/common/Avatar';
import { isCancelledWorkItem } from '../../../utils/roleUtils';
import type { Task } from '../../../types';

interface ProjectRoadmapProps {
  projectId: string;
}

interface RoadmapItem {
  id: string;
  name: string;
  type: 'initiative' | 'epic' | 'task' | 'sprint' | 'release';
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  color: string;
  children?: RoadmapItem[];
  assigneeId?: string;
  priority?: string;
}

export const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ projectId }) => {
  const { projects, tasks, sprints, releases, users, initiatives } = useAppStore();
  const project = projects.find((p) => p.id === projectId);

  const [filterTeam, setFilterTeam] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [groupBy, setGroupBy] = useState<'none' | 'initiative' | 'sprint' | 'release'>('none');

  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const projectSprints = sprints.filter((s) => s.projectId === projectId);
  const projectReleases = releases.filter((r) => r.projectId === projectId);
  const projectEpics = projectTasks.filter((t) => t.type === 'EPIC');
  const projectInitiatives = initiatives.filter((i) => i.projectId === projectId);

  const roadmapItems = useMemo((): RoadmapItem[] => {
    const items: RoadmapItem[] = [];

    // Add initiatives as top-level items
    if (groupBy === 'initiative' && projectInitiatives.length > 0) {
      projectInitiatives.forEach((initiative) => {
        const initiativeEpics = projectEpics.filter((e) => initiative.epicIds.includes(e.id));
        items.push({
          id: initiative.id,
          name: initiative.name,
          type: 'initiative',
          startDate: initiative.startDate || '2024-07-01',
          endDate: initiative.targetDate || '2024-12-31',
          progress: initiative.progress,
          status: initiative.status,
          color: '#7c3aed',
          children: initiativeEpics.map((epic) => ({
            id: epic.id,
            name: epic.title,
            type: 'epic' as const,
            startDate: epic.startDate || '2024-07-01',
            endDate: epic.dueDate || '2024-12-31',
            progress: 0,
            status: epic.status,
            color: '#1a73e8',
          })),
        });
      });
    }

    // Add releases as top-level items
    if (groupBy === 'release' || (!groupBy || groupBy === 'none')) {
      projectReleases.forEach((release) => {
        items.push({
          id: release.id,
          name: `${release.name} (${release.version})`,
          type: 'release',
          startDate: release.startDate,
          endDate: release.targetDate,
          progress: release.progress,
          status: release.status,
          color: '#7c3aed',
        });
      });
    }

    // Add sprints as top-level items
    if (groupBy === 'sprint' || (!groupBy || groupBy === 'none')) {
      projectSprints.forEach((sprint) => {
        const sprintTasks = projectTasks.filter((t) => t.sprintId === sprint.id && !isCancelledWorkItem(t));
        const doneTasks = sprintTasks.filter((t) => t.status === 'DONE').length;
        const progress = sprintTasks.length > 0 ? Math.round((doneTasks / sprintTasks.length) * 100) : 0;

        items.push({
          id: sprint.id,
          name: sprint.name,
          type: 'sprint',
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          progress,
          status: sprint.status,
          color: sprint.status === 'ACTIVE' ? '#1a73e8' : sprint.status === 'COMPLETED' ? '#34a853' : '#747775',
        });
      });
    }

    // Add epics with their child tasks (only when not grouped by initiative)
    if (groupBy !== 'initiative') {
      projectEpics.forEach((epic) => {
        const childTasks = projectTasks.filter((t) => t.parentId === epic.id);
        // Cancelled children leave the progress ratio entirely.
        const scopeTasks = childTasks.filter((t) => !isCancelledWorkItem(t));
        const doneTasks = scopeTasks.filter((t) => t.status === 'DONE').length;
        const progress = scopeTasks.length > 0 ? Math.round((doneTasks / scopeTasks.length) * 100) : 0;

        items.push({
          id: epic.id,
          name: epic.title,
          type: 'epic',
          startDate: epic.startDate || epic.createdAt,
          endDate: epic.dueDate || epic.createdAt,
          progress,
          status: epic.status,
          color: '#d97706',
          assigneeId: epic.assigneeId,
          priority: epic.priority,
          children: childTasks.map((task) => ({
            id: task.id,
            name: task.title,
            type: 'task' as const,
            startDate: task.startDate || task.createdAt,
            endDate: task.dueDate || task.createdAt,
            progress: isCancelledWorkItem(task) ? 0 : task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0,
            status: task.status,
            color: isCancelledWorkItem(task) ? '#94a3b8' : task.status === 'DONE' ? '#34a853' : task.status === 'IN_PROGRESS' ? '#1a73e8' : '#747775',
            assigneeId: task.assigneeId,
            priority: task.priority,
          })),
        });
      });
    }

    // Add standalone tasks (not in epics, not in sprints)
    projectTasks
      .filter((t) => t.type !== 'EPIC' && !t.parentId && !t.sprintId)
      .forEach((task) => {
        items.push({
          id: task.id,
          name: task.title,
          type: 'task',
          startDate: task.startDate || task.createdAt,
          endDate: task.dueDate || task.createdAt,
          progress: isCancelledWorkItem(task) ? 0 : task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0,
          status: task.status,
          color: isCancelledWorkItem(task) ? '#94a3b8' : task.status === 'DONE' ? '#34a853' : task.status === 'IN_PROGRESS' ? '#1a73e8' : '#747775',
          assigneeId: task.assigneeId,
          priority: task.priority,
        });
      });

    return items;
  }, [projectTasks, projectSprints, projectReleases, projectEpics, projectInitiatives, groupBy]);

  const filteredItems = useMemo(() => {
    return roadmapItems.filter((item) => {
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterPriority && item.priority !== filterPriority) return false;
      if (filterTeam) {
        if (item.type === 'task' && item.assigneeId) {
          const assignee = users.find((u) => u.id === item.assigneeId);
          if (assignee?.teamId !== filterTeam) return false;
        }
      }
      return true;
    });
  }, [roadmapItems, filterStatus, filterPriority, filterTeam, users]);

  // Calculate timeline bounds
  const allDates = filteredItems.flatMap((item) => [
    new Date(item.startDate).getTime(),
    new Date(item.endDate).getTime(),
  ]);
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

  const getPosition = (date: string) => {
    const d = new Date(date).getTime();
    return ((d - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
  };

  const getWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, ((e - s) / (maxDate.getTime() - minDate.getTime())) * 100);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!project) {
    return (
      <div className="card p-8 text-center">
        <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-600">Project not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#747775]" />
            <span className="text-xs font-bold text-[#747775]">Filters:</span>
          </div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="select text-xs py-1.5"
          >
            <option value="none">No Grouping</option>
            <option value="initiative">Group by Initiative</option>
            <option value="sprint">Group by Iteration</option>
            <option value="release">Group by Release</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select text-xs py-1.5"
          >
            <option value="">All Status</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DONE">Done</option>
            <option value="TODO">To Do</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="select text-xs py-1.5"
          >
            <option value="">All Priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#e0e2ec]">
          <h3 className="text-sm font-bold text-[#1f1f1f] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#1a73e8]" />
            Project Roadmap
          </h3>
          <p className="text-xs text-[#747775] mt-0.5">{project.name} — Timeline View</p>
        </div>

        {/* Timeline Header */}
        <div className="flex border-b border-[#e0e2ec] bg-[#f8fafd]">
          <div className="w-64 flex-shrink-0 p-3 border-r border-[#e0e2ec]">
            <span className="text-[10px] font-bold text-[#747775] uppercase tracking-wider">Item</span>
          </div>
          <div className="flex-1 p-3 overflow-x-auto">
            <div className="flex justify-between text-[10px] text-[#747775]">
              {Array.from({ length: Math.min(12, totalDays) }).map((_, i) => {
                const date = new Date(minDate);
                date.setDate(minDate.getDate() + Math.round((i / 11) * totalDays));
                return (
                  <span key={i}>{formatShortDate(date.toISOString())}</span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Timeline Body */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-[#747775]">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No items match the current filters.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id}>
                <div className="flex border-b border-[#f1f3f4] hover:bg-[#f8fafd]">
                  {/* Item Name */}
                  <div className="w-64 flex-shrink-0 p-3 border-r border-[#e0e2ec] flex items-center gap-2">
                    {item.children && item.children.length > 0 && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-0.5 rounded hover:bg-slate-200"
                      >
                        {expandedItems[item.id] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#747775]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#747775]" />
                        )}
                      </button>
                    )}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1f1f1f] truncate">{item.name}</div>
                      <div className="text-[10px] text-[#747775]">{item.type} · {item.progress}%</div>
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="flex-1 p-3 relative">
                    <div className="relative h-5">
                      <div
                        className="absolute h-5 rounded-md opacity-20"
                        style={{
                          left: `${getPosition(item.startDate)}%`,
                          width: `${getWidth(item.startDate, item.endDate)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                      <div
                        className="absolute h-5 rounded-md"
                        style={{
                          left: `${getPosition(item.startDate)}%`,
                          width: `${Math.max(getWidth(item.startDate, item.endDate) * (item.progress / 100), 2)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                      <div
                        className="absolute top-0.5 text-[9px] font-bold text-[#1f1f1f] whitespace-nowrap"
                        style={{
                          left: `calc(${getPosition(item.startDate)}% + ${getWidth(item.startDate, item.endDate) * (item.progress / 100)}% + 4px)`,
                        }}
                      >
                        {item.progress}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Children */}
                {expandedItems[item.id] && item.children?.map((child) => (
                  <div key={child.id} className="flex border-b border-[#f1f3f4] hover:bg-[#f8fafd] bg-[#fafbfc]">
                    <div className="w-64 flex-shrink-0 p-3 pl-10 border-r border-[#e0e2ec] flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: child.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-[#1f1f1f] truncate">{child.name}</div>
                        <div className="text-[10px] text-[#747775]">{child.progress}%</div>
                      </div>
                    </div>
                    <div className="flex-1 p-3 relative">
                      <div className="relative h-4">
                        <div
                          className="absolute h-4 rounded opacity-20"
                          style={{
                            left: `${getPosition(child.startDate)}%`,
                            width: `${getWidth(child.startDate, child.endDate)}%`,
                            backgroundColor: child.color,
                          }}
                        />
                        <div
                          className="absolute h-4 rounded"
                          style={{
                            left: `${getPosition(child.startDate)}%`,
                            width: `${Math.max(getWidth(child.startDate, child.endDate) * (child.progress / 100), 2)}%`,
                            backgroundColor: child.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-[#e0e2ec] bg-[#f8fafd] flex items-center gap-4 text-[10px] text-[#747775]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded bg-[#7c3aed]" />
            <span>Release</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded bg-[#1a73e8]" />
            <span>Iteration</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded bg-[#d97706]" />
            <span>Epic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded bg-[#34a853]" />
            <span>Done</span>
          </div>
        </div>
      </div>
    </div>
  );
};
