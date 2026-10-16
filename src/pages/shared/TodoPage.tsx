import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  CheckSquare,
  AlertCircle,
  Edit2,
  Sparkles,
  Check,
  Briefcase,
  FolderKanban,
  User,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { PriorityBadge } from '../../components/common/Badges';
import { EmptyState } from '../../components/common/EmptyState';
import type { Priority, Todo } from '../../types';
import { getDueDateLabel, getDueDateClass, isDueToday, isOverdue } from '../../utils/dateUtils';
import { issuePath } from '../../utils/issueUrl';
import { toast } from 'sonner';

export const TodoPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { todos, createTodo, toggleTodo, deleteTodo, updateTodo, projects, users } = useAppStore();

  const [filter, setFilter] = useState<'ALL' | 'ASSIGNED' | 'PERSONAL' | 'TODAY' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    notes: '',
    priority: 'MEDIUM' as Priority,
    dueDate: new Date().toISOString().split('T')[0],
  });

  const myTodos = todos.filter((t) => t.userId === currentUser?.id);

  const assignedCount = myTodos.filter((t) => t.source === 'ASSIGNED' || Boolean(t.taskId)).length;
  const personalCount = myTodos.filter((t) => t.source !== 'ASSIGNED' && !t.taskId).length;
  const completedCount = myTodos.filter((t) => t.completed).length;

  const filteredTodos = myTodos.filter((todo) => {
    const isAssigned = todo.source === 'ASSIGNED' || Boolean(todo.taskId);
    if (filter === 'ASSIGNED') return isAssigned && !todo.completed;
    if (filter === 'PERSONAL') return !isAssigned && !todo.completed;
    if (filter === 'TODAY') return !todo.completed && (isDueToday(todo.dueDate) || isOverdue(todo.dueDate));
    if (filter === 'UPCOMING') return !todo.completed && todo.dueDate && !isDueToday(todo.dueDate) && !isOverdue(todo.dueDate);
    if (filter === 'COMPLETED') return todo.completed;
    return true;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !currentUser) return;

    if (editingId) {
      updateTodo(editingId, {
        title: form.title,
        notes: form.notes,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      toast.success('Todo updated');
      setEditingId(null);
    } else {
      createTodo({
        userId: currentUser.id,
        title: form.title,
        notes: form.notes,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      toast.success('Personal todo added');
    }

    setForm({ title: '', notes: '', priority: 'MEDIUM', dueDate: new Date().toISOString().split('T')[0] });
    setShowAdd(false);
  };

  const handleEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setForm({
      title: todo.title,
      notes: todo.notes || '',
      priority: todo.priority,
      dueDate: todo.dueDate || '',
    });
    setShowAdd(true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ccfbf1] text-[#0d9488] text-xs font-semibold mb-1.5">
            <Sparkles className="w-3 h-3 text-[#0d9488]" />
            Personal & Assigned Work Dashboard
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1a1d23] font-display">My To-Do List</h1>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Unified workspace agenda and tasks for {currentUser?.name}
          </p>
        </div>
        <button
          className="btn-primary shadow-sm"
          onClick={() => {
            setEditingId(null);
            setForm({ title: '', notes: '', priority: 'MEDIUM', dueDate: new Date().toISOString().split('T')[0] });
            setShowAdd(!showAdd);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Add Personal Task</span>
        </button>
      </div>

      {/* Distinction & Auto-Sync Alert */}
      <div className="p-4 rounded-2xl bg-[#f0fdfa]/80 border border-[#ccfbf1] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#ccfbf1] text-[#0d9488] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-xs text-[#134e4a] leading-relaxed">
          <span className="font-bold text-[#0f766e]">Automatic Task Synchronization:</span> Whenever a Team Leader, Project Manager, or Admin assigns a task to you, it is automatically added to your To-Do list so you never miss an assigned deliverable.
        </p>
      </div>

      {/* Summary Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#e2e5ea] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#6b7280] font-medium">
            <span>Total Items</span>
            <ListTodo className="w-4 h-4 text-[#0d9488]" />
          </div>
          <p className="text-xl font-bold text-[#1a1d23] mt-1.5">{myTodos.length}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e2e5ea] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#6b7280] font-medium">
            <span>Assigned Work</span>
            <Briefcase className="w-4 h-4 text-[#0284c7]" />
          </div>
          <p className="text-xl font-bold text-[#0284c7] mt-1.5">{assignedCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e2e5ea] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#6b7280] font-medium">
            <span>Personal Agenda</span>
            <User className="w-4 h-4 text-[#8b5cf6]" />
          </div>
          <p className="text-xl font-bold text-[#8b5cf6] mt-1.5">{personalCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e2e5ea] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#6b7280] font-medium">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
          </div>
          <p className="text-xl font-bold text-[#10b981] mt-1.5">{completedCount}</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: 'ALL', label: `All (${myTodos.length})` },
            { id: 'ASSIGNED', label: `Assigned to Me (${assignedCount})` },
            { id: 'PERSONAL', label: `Personal (${personalCount})` },
            { id: 'TODAY', label: 'Due Today' },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'COMPLETED', label: `Completed (${completedCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === tab.id
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-white border border-[#e2e5ea] text-[#4b5563] hover:bg-[#f8fafc]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add / Edit Form */}
      {showAdd && (
        <div className="bg-white rounded-3xl p-6 border-2 border-[#0d9488] shadow-md animate-slide-in">
          <h3 className="text-sm font-bold text-[#1f1f1f] mb-4 font-display">
            {editingId ? 'Edit Task' : 'New Personal Task'}
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="input-label">Task Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Review architecture specifications..."
                className="input"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="input-label">Notes (Optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add notes or bullet points..."
                className="input resize-none h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                  className="select"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical</option>
                </select>
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
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center">
                {editingId ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Todos List */}
      <div className="space-y-2.5">
        {filteredTodos.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CheckSquare}
              title="All tasks cleared!"
              description={
                filter === 'COMPLETED'
                  ? 'No completed tasks recorded yet.'
                  : filter === 'ASSIGNED'
                  ? 'No assigned work items pending for you right now.'
                  : 'No tasks found for this view.'
              }
              action={filter !== 'COMPLETED' && filter !== 'ASSIGNED' ? { label: 'Add Personal Task', onClick: () => setShowAdd(true) } : undefined}
            />
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const isAssigned = todo.source === 'ASSIGNED' || Boolean(todo.taskId);
            const project = todo.projectId ? projects.find((p) => p.id === todo.projectId) : undefined;
            const assigner = todo.assignedById ? users.find((u) => u.id === todo.assignedById) : undefined;

            return (
              <div
                key={todo.id}
                className={`bg-white rounded-2xl p-4 border border-[#e2e5ea] flex items-start gap-3.5 transition-all shadow-2xs ${
                  todo.completed ? 'bg-[#f8fafc] opacity-75' : 'hover:shadow-md hover:border-[#ccfbf1]'
                }`}
              >
                {/* Complete checkbox */}
                <button
                  type="button"
                  onClick={() => {
                    toggleTodo(todo.id);
                    toast.success(
                      todo.completed
                        ? 'Task reopened'
                        : isAssigned
                        ? 'Task completed (synced to project)'
                        : 'Task completed'
                    );
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 border transition-colors flex-shrink-0 ${
                    todo.completed ? 'bg-[#0d9488] border-[#0d9488] text-white' : 'border-[#d1d5db] hover:border-[#0d9488] bg-white'
                  }`}
                  title={todo.completed ? 'Mark pending' : 'Mark completed'}
                >
                  {todo.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-sm font-bold text-[#1a1d23] ${todo.completed ? 'line-through text-[#9ca3af]' : ''}`}>
                      {todo.title}
                    </span>
                    <PriorityBadge priority={todo.priority} />

                    {/* Source tag */}
                    {isAssigned ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]">
                        <Briefcase className="w-3 h-3 text-[#0284c7]" />
                        Assigned Task
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">
                        <User className="w-3 h-3 text-[#9ca3af]" />
                        Personal
                      </span>
                    )}

                    {/* Project tag if available */}
                    {project && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                        <FolderKanban className="w-3 h-3 text-[#64748b]" />
                        {project.name}
                      </span>
                    )}
                  </div>

                  {todo.notes && <p className="text-xs text-[#6b7280] mb-2 leading-relaxed">{todo.notes}</p>}

                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    {todo.dueDate && (
                      <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${getDueDateClass(todo.dueDate)}`}>
                        {getDueDateLabel(todo.dueDate)}
                      </span>
                    )}
                    {assigner && isAssigned && (
                      <span className="text-[#9ca3af]">
                        Assigned by: <span className="font-semibold text-[#4b5563]">{assigner.name}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {todo.taskId && (
                    <button
                      className="p-1.5 rounded-lg text-[#0284c7] hover:bg-[#e0f2fe] transition-colors"
                      title="View Task Details"
                      onClick={() => navigate(issuePath(todo.taskId))}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-full text-[#9ca3af] hover:text-[#1a1d23] hover:bg-[#f8fafc]"
                    title="Edit Note"
                    onClick={() => handleEdit(todo)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-full text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fee2e2]"
                    title="Remove"
                    onClick={() => {
                      deleteTodo(todo.id);
                      toast.success('Task removed from list');
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
