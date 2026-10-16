import React, { useState } from 'react';
import { X, ClipboardList } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { SearchableUserSelect } from '../../components/common/SearchableUserSelect';
import type { Priority, Task } from '../../types';
import { toast } from 'sonner';

interface AssignTaskModalProps {
  onClose: () => void;
  defaultProjectId?: string;
  sprintMemberIds?: string[];
}

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({ onClose, defaultProjectId, sprintMemberIds }) => {
  const { projects, sprints, users, teams, createTask, workflows } = useAppStore();
  const { currentUser } = useAuthStore();

  const myTeam = teams.find((t) => t.id === currentUser?.teamId);

  const [form, setForm] = useState({
    projectId: defaultProjectId || projects[0]?.id || '',
    sprintId: '',
    stageId: '',
    assigneeId: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as Priority,
    type: 'FEATURE' as Task['type'],
    dueDate: '',
    estimatedHours: 8,
  });

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const projectSprints = sprints.filter((s) => s.projectId === form.projectId && s.status !== 'COMPLETED');
  const projectWorkflow = workflows.find((w) => w.id === selectedProject?.workflowId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    createTask({
      projectId: form.projectId,
      sprintId: form.sprintId || undefined,
      stageId: form.stageId || selectedProject?.currentStageId,
      teamId: myTeam?.id,
      teamLeaderId: currentUser?.id,
      assigneeId: form.assigneeId || undefined,
      createdById: currentUser?.id || '',
      title: form.title,
      description: form.description,
      type: form.type,
      status: form.assigneeId ? 'IN_PROGRESS' : 'TODO',
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      estimatedHours: Number(form.estimatedHours),
    });

    const assignee = users.find((u) => u.id === form.assigneeId);
    toast.success(assignee ? `Task assigned to ${assignee.name}` : 'Task created');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-modal animate-scale-in max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign Work</h2>
            <p className="text-sm text-slate-500 mt-0.5">Assign a task to a team member</p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="input-label">Project</label>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value, sprintId: '', stageId: '' })}
              className="select"
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Iteration <span className="text-slate-400 font-normal">(optional)</span></label>
              <select
                value={form.sprintId}
                onChange={(e) => setForm({ ...form, sprintId: e.target.value })}
                className="select"
              >
                <option value="">No Iteration (Work Queue)</option>
                {projectSprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Workflow Stage</label>
              <select
                value={form.stageId}
                onChange={(e) => setForm({ ...form, stageId: e.target.value })}
                className="select"
              >
                <option value="">Default Stage</option>
                {projectWorkflow?.stages.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Task Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Implement Product Search API"
              className="input"
              required
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed work instructions..."
              className="input resize-none h-20"
            />
          </div>

          <div>
            <label className="input-label">Assign To Member</label>
            <p className="text-xs text-slate-400 mb-2">
              {sprintMemberIds && sprintMemberIds.length > 0
                ? 'Showing members assigned to this iteration'
                : 'Showing active members in your team'}
            </p>
            <SearchableUserSelect
              users={users}
              value={form.assigneeId}
              onChange={(id) => setForm({ ...form, assigneeId: id })}
              filterRole={['MEMBER']}
              filterIds={sprintMemberIds && sprintMemberIds.length > 0 ? sprintMemberIds : undefined}
              filterTeamId={!(sprintMemberIds && sprintMemberIds.length > 0) ? myTeam?.id : undefined}
              placeholder="Search team member..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Task Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Task['type'] })}
                className="select"
              >
                <option value="FEATURE">Feature</option>
                <option value="TASK">Task</option>
                <option value="STORY">Story</option>
                <option value="BUG_FIX">Bug Fix</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="SUB-TASK">Sub-task</option>
              </select>
            </div>
            <div>
              <label className="input-label">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="select"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">
              <ClipboardList className="w-4 h-4" />
              Assign Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
