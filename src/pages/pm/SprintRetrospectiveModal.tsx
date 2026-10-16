import React, { useState, useMemo } from 'react';
import {
  X, Sparkles, ThumbsUp, Plus, Trash2, CheckCircle2,
  Clock, Users, Target, ArrowRight, UserCheck, Check,
  Copy, Edit3, MessageSquareHeart, AlertCircle, Shield,
  Layers, Lightbulb, Heart, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { SprintStatusBadge } from '../../components/common/Badges';
import { ProgressBar } from '../../components/common/ProgressBar';
import { formatDate } from '../../utils/dateUtils';
import type {
  Sprint,
  RetrospectiveCategory,
  RetrospectiveTemplate,
  RetrospectiveItem,
  RetroActionStatus,
  RetrospectiveStatus
} from '../../types';
import { toast } from 'sonner';

interface SprintRetrospectiveModalProps {
  sprint: Sprint;
  isOpen: boolean;
  onClose: () => void;
}

interface ColumnConfig {
  key: RetrospectiveCategory;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  headerBg: string;
  accentColor: string;
}

const TEMPLATE_COLUMNS: Record<RetrospectiveTemplate, ColumnConfig[]> = {
  STANDARD: [
    {
      key: 'WHAT_WENT_WELL',
      title: 'What Went Well',
      subtitle: 'Successes, achievements & good practices',
      icon: Sparkles,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'text-emerald-700',
      borderAccent: 'border-emerald-500',
      headerBg: 'bg-emerald-500/10',
      accentColor: '#10b981',
    },
    {
      key: 'NEEDS_IMPROVEMENT',
      title: 'Could Be Improved',
      subtitle: 'Friction, bottlenecks & missed targets',
      icon: AlertCircle,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: 'text-rose-700',
      borderAccent: 'border-rose-500',
      headerBg: 'bg-rose-500/10',
      accentColor: '#ef4444',
    },
    {
      key: 'ACTION_ITEMS',
      title: 'Action Items',
      subtitle: 'Commitments & changes for next iteration',
      icon: Target,
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeText: 'text-blue-700',
      borderAccent: 'border-blue-500',
      headerBg: 'bg-blue-500/10',
      accentColor: '#3b82f6',
    },
    {
      key: 'KUDOS',
      title: 'Kudos & Shoutouts',
      subtitle: 'Team appreciation & positive peer feedback',
      icon: Heart,
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeText: 'text-amber-700',
      borderAccent: 'border-amber-500',
      headerBg: 'bg-amber-500/10',
      accentColor: '#f59e0b',
    },
  ],
  START_STOP_CONTINUE: [
    {
      key: 'START',
      title: 'Start Doing',
      subtitle: 'New ideas or processes we should introduce',
      icon: Plus,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'text-emerald-700',
      borderAccent: 'border-emerald-500',
      headerBg: 'bg-emerald-500/10',
      accentColor: '#10b981',
    },
    {
      key: 'STOP',
      title: 'Stop Doing',
      subtitle: 'Habits or tasks hindering efficiency',
      icon: AlertCircle,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: 'text-rose-700',
      borderAccent: 'border-rose-500',
      headerBg: 'bg-rose-500/10',
      accentColor: '#ef4444',
    },
    {
      key: 'CONTINUE',
      title: 'Continue Doing',
      subtitle: 'High-value practices that are working well',
      icon: Sparkles,
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badgeText: 'text-indigo-700',
      borderAccent: 'border-indigo-500',
      headerBg: 'bg-indigo-500/10',
      accentColor: '#6366f1',
    },
    {
      key: 'ACTION_ITEMS',
      title: 'Action Items',
      subtitle: 'Direct commitments with owners',
      icon: Target,
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeText: 'text-blue-700',
      borderAccent: 'border-blue-500',
      headerBg: 'bg-blue-500/10',
      accentColor: '#3b82f6',
    },
  ],
  FOUR_LS: [
    {
      key: 'LIKED',
      title: 'Liked',
      subtitle: 'What did you appreciate or enjoy most?',
      icon: Heart,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'text-emerald-700',
      borderAccent: 'border-emerald-500',
      headerBg: 'bg-emerald-500/10',
      accentColor: '#10b981',
    },
    {
      key: 'LEARNED',
      title: 'Learned',
      subtitle: 'Key insights, technologies or skills discovered',
      icon: Lightbulb,
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badgeText: 'text-indigo-700',
      borderAccent: 'border-indigo-500',
      headerBg: 'bg-indigo-500/10',
      accentColor: '#6366f1',
    },
    {
      key: 'LACKED',
      title: 'Lacked',
      subtitle: 'What was missing or could have been better?',
      icon: HelpCircle,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: 'text-rose-700',
      borderAccent: 'border-rose-500',
      headerBg: 'bg-rose-500/10',
      accentColor: '#ef4444',
    },
    {
      key: 'LONGED_FOR',
      title: 'Longed For',
      subtitle: 'What you wish existed or had happened',
      icon: Sparkles,
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeText: 'text-amber-700',
      borderAccent: 'border-amber-500',
      headerBg: 'bg-amber-500/10',
      accentColor: '#f59e0b',
    },
  ],
};

export const SprintRetrospectiveModal: React.FC<SprintRetrospectiveModalProps> = ({
  sprint,
  isOpen,
  onClose,
}) => {
  const {
    tasks,
    users,
    retrospectives,
    retrospectiveItems,
    addRetroItem,
    deleteRetroItem,
    voteRetroItem,
    updateRetroActionItem,
    convertRetroActionToTask,
    updateSprintRetrospective,
  } = useAppStore();

  const { currentUser } = useAuthStore();

  // Active retrospective record (or fallback defaults)
  const currentRetro = useMemo(() => {
    return retrospectives.find((r) => r.sprintId === sprint.id) || {
      id: `retro-${sprint.id}`,
      sprintId: sprint.id,
      projectId: sprint.projectId,
      status: 'IN_PROGRESS' as RetrospectiveStatus,
      template: 'STANDARD' as RetrospectiveTemplate,
      summary: '',
      facilitatorId: currentUser?.id || 'u-pm-01',
      conductedDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [retrospectives, sprint.id, sprint.projectId, currentUser?.id]);

  const [activeTemplate, setActiveTemplate] = useState<RetrospectiveTemplate>(
    currentRetro.template || 'STANDARD'
  );

  const [showSummaryEditor, setShowSummaryEditor] = useState(false);
  const [summaryText, setSummaryText] = useState(currentRetro.summary || '');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // New card inline states per category column
  const [activeAddCategory, setActiveAddCategory] = useState<RetrospectiveCategory | null>(null);
  const [newCardContent, setNewCardContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [newActionAssigneeId, setNewActionAssigneeId] = useState<string>('');
  const [newActionDueDate, setNewActionDueDate] = useState<string>('');

  // All items for this sprint
  const sprintRetroItems = useMemo(() => {
    return retrospectiveItems.filter((item) => item.sprintId === sprint.id);
  }, [retrospectiveItems, sprint.id]);

  // Iteration task completion & velocity metrics
  const sprintTasks = useMemo(() => tasks.filter((t) => t.sprintId === sprint.id), [tasks, sprint.id]);
  const doneTasks = sprintTasks.filter((t) => t.status === 'DONE');
  const completionPct = sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0;
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const completedPoints = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  // Columns for current template
  const currentColumns = useMemo(() => {
    return TEMPLATE_COLUMNS[activeTemplate] || TEMPLATE_COLUMNS.STANDARD;
  }, [activeTemplate]);

  // Handle template change
  const handleTemplateChange = (tmpl: RetrospectiveTemplate) => {
    setActiveTemplate(tmpl);
    updateSprintRetrospective(sprint.id, { template: tmpl, projectId: sprint.projectId });
    toast.success(`Retrospective format updated to ${tmpl.replace(/_/g, ' ')}`);
  };

  // Handle status change
  const handleStatusChange = (status: RetrospectiveStatus) => {
    updateSprintRetrospective(sprint.id, { status, projectId: sprint.projectId });
    toast.success(`Retrospective status marked as ${status}`);
  };

  // Handle adding card
  const handleCreateCard = (category: RetrospectiveCategory) => {
    if (!newCardContent.trim()) {
      toast.error('Please enter feedback content');
      return;
    }

    addRetroItem({
      sprintId: sprint.id,
      projectId: sprint.projectId,
      category,
      content: newCardContent.trim(),
      authorId: currentUser?.id || 'u-pm-01',
      authorName: isAnonymous ? 'Anonymous' : (currentUser?.name || 'Rahul Kumar'),
      isAnonymous,
      actionItemStatus: category === 'ACTION_ITEMS' ? 'TODO' : undefined,
      actionAssigneeId: category === 'ACTION_ITEMS' && newActionAssigneeId ? newActionAssigneeId : undefined,
      actionDueDate: category === 'ACTION_ITEMS' && newActionDueDate ? newActionDueDate : undefined,
    });

    setNewCardContent('');
    setIsAnonymous(false);
    setNewActionAssigneeId('');
    setNewActionDueDate('');
    setActiveAddCategory(null);
    toast.success('Card added to retrospective');
  };

  // Handle upvoting card
  const handleVote = (itemId: string) => {
    const userId = currentUser?.id || 'u-pm-01';
    voteRetroItem(itemId, userId);
  };

  // Handle deleting card
  const handleDelete = (itemId: string) => {
    deleteRetroItem(itemId);
    toast.success('Card removed');
  };

  // Handle converting action item to project task
  const handleConvertToTask = (item: RetrospectiveItem) => {
    const createdTask = convertRetroActionToTask(
      item.id,
      sprint.projectId,
      item.content,
      item.actionAssigneeId
    );
    toast.success(`Converted to task: "${createdTask.title}"`);
  };

  // AI / Smart synthesis of retro takeaways
  const handleGenerateSummary = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      const wellCount = sprintRetroItems.filter((i) => i.category === 'WHAT_WENT_WELL' || i.category === 'START' || i.category === 'LIKED').length;
      const improveCount = sprintRetroItems.filter((i) => i.category === 'NEEDS_IMPROVEMENT' || i.category === 'STOP' || i.category === 'LACKED').length;
      const actionCount = sprintRetroItems.filter((i) => i.category === 'ACTION_ITEMS').length;

      const topVoted = [...sprintRetroItems].sort((a, b) => b.votes.length - a.votes.length).slice(0, 2);
      const topThemes = topVoted.map((i) => `"${i.content.slice(0, 60)}..."`).join(' and ');

      const autoSummary = `Iteration Retrospective Summary for ${sprint.name} (${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}):
• Velocity & Delivery: ${completionPct}% task completion (${doneTasks.length}/${sprintTasks.length} tasks), delivering ${completedPoints}/${totalPoints || completedPoints} story points.
• Key Highlights: The team surfaced ${wellCount} positive wins and acknowledged high peer collaboration. Key points raised included ${topThemes || 'strong delivery execution'}.
• Areas for Improvement: Identified ${improveCount} friction points around workflow handoffs and environment tooling.
• Actionable Next Steps: Committed to ${actionCount} concrete action items tracked with assignees for continuous delivery improvement.`;

      setSummaryText(autoSummary);
      updateSprintRetrospective(sprint.id, { summary: autoSummary, projectId: sprint.projectId });
      setIsAiGenerating(false);
      setShowSummaryEditor(true);
      toast.success('AI summary generated from retrospective discussion!');
    }, 600);
  };

  // Save manual summary
  const handleSaveSummary = () => {
    updateSprintRetrospective(sprint.id, { summary: summaryText, projectId: sprint.projectId });
    toast.success('Retrospective notes saved');
  };

  // Copy meeting notes
  const handleCopyNotes = () => {
    const lines: string[] = [
      `# Iteration Retrospective: ${sprint.name}`,
      `Date: ${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`,
      `Status: ${currentRetro.status} | Completion: ${completionPct}% (${doneTasks.length}/${sprintTasks.length} tasks)`,
      '',
      summaryText ? `## Summary & Takeaways\n${summaryText}\n` : '',
      '## Discussion Cards:',
    ];

    currentColumns.forEach((col) => {
      const items = sprintRetroItems.filter((i) => i.category === col.key);
      lines.push(`\n### ${col.title} (${items.length})`);
      if (items.length === 0) {
        lines.push('- No items recorded');
      } else {
        items.forEach((item) => {
          const author = item.isAnonymous ? 'Anonymous' : item.authorName;
          lines.push(`- ${item.content} (by ${author}, ${item.votes.length} votes)`);
          if (item.category === 'ACTION_ITEMS') {
            const assignee = users.find((u) => u.id === item.actionAssigneeId)?.name || 'Unassigned';
            lines.push(`  * Status: ${item.actionItemStatus || 'TODO'} | Owner: ${assignee}${item.actionDueDate ? ` | Due: ${item.actionDueDate}` : ''}`);
          }
        });
      }
    });

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Retrospective notes copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-4 overflow-y-auto">
      <div className="bg-slate-50 border border-slate-200 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* TOP HEADER */}
        <div
          className="p-5 sm:p-6 text-white flex-shrink-0 relative overflow-hidden bg-slate-900 border-b border-slate-800"
          style={{
            backgroundColor: '#0f172a',
            backgroundImage: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #042f2e 100%)',
          }}
        >
          <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                <span className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                  <MessageSquareHeart className="w-5 h-5 text-teal-300" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-white font-display">
                  Iteration Retrospective: {sprint.name}
                </h2>
                <SprintStatusBadge status={sprint.status} />

                {/* Retrospective Status selector */}
                <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-700 text-xs">
                  <button
                    onClick={() => handleStatusChange('DRAFT')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      currentRetro.status === 'DRAFT'
                        ? 'bg-slate-700 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      currentRetro.status === 'IN_PROGRESS'
                        ? 'bg-teal-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    In Session
                  </button>
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      currentRetro.status === 'COMPLETED'
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-white font-medium">
                    {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                  </span>
                </span>
                {sprint.goal ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/30 text-xs">
                    <Target className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                    <span className="text-slate-300 font-medium">Goal:</span>
                    <span className="text-teal-200 font-semibold">{sprint.goal}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 italic">
                    <Target className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>No goal set</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metrics & Close */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex items-center gap-2 bg-slate-850 border border-slate-700/90 px-3.5 py-1.5 rounded-2xl">
                <div className="text-center">
                  <div className="text-xs font-bold text-teal-300">{completionPct}%</div>
                  <div className="text-[10px] text-slate-300">Done ({doneTasks.length}/{sprintTasks.length})</div>
                </div>
                {totalPoints > 0 && (
                  <>
                    <div className="h-6 w-px bg-slate-700 mx-1" />
                    <div className="text-center">
                      <div className="text-xs font-bold text-teal-300">{completedPoints} pts</div>
                      <div className="text-[10px] text-slate-300">Velocity</div>
                    </div>
                  </>
                )}
                <div className="h-6 w-px bg-slate-700 mx-1" />
                <div className="text-center">
                  <div className="text-xs font-bold text-teal-300">{sprintRetroItems.length}</div>
                  <div className="text-[10px] text-slate-300">Ideas</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CEREMONY CONTROLS TOOLBAR */}
          <div className="mt-4 pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Template Picker */}
            <div className="flex items-center gap-2">
              <span className="text-slate-200 flex items-center gap-1 font-semibold">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                Template:
              </span>
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => handleTemplateChange('STANDARD')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTemplate === 'STANDARD'
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Standard Agile
                </button>
                <button
                  onClick={() => handleTemplateChange('START_STOP_CONTINUE')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTemplate === 'START_STOP_CONTINUE'
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Start / Stop / Continue
                </button>
                <button
                  onClick={() => handleTemplateChange('FOUR_LS')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTemplate === 'FOUR_LS'
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  4 Ls
                </button>
              </div>
            </div>

            {/* AI Summary & Action Bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateSummary}
                disabled={isAiGenerating}
                className="btn-secondary btn-sm bg-slate-800/90 text-teal-300 border-teal-500/30 hover:bg-teal-900/40 hover:text-white flex items-center gap-1.5 transition-all text-xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : 'text-teal-400'}`} />
                <span>{isAiGenerating ? 'Synthesizing...' : 'AI Retro Insights'}</span>
              </button>

              <button
                onClick={() => setShowSummaryEditor(!showSummaryEditor)}
                className={`btn-secondary btn-sm text-xs ${
                  showSummaryEditor ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Summary Notes</span>
                {summaryText && <span className="w-2 h-2 rounded-full bg-teal-400" />}
              </button>

              <button
                onClick={handleCopyNotes}
                className="btn-secondary btn-sm bg-slate-800 text-slate-300 border-slate-700 hover:text-white flex items-center gap-1.5 text-xs"
                title="Copy markdown meeting notes to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE SUMMARY & TAKEAWAYS DRAWER */}
        {showSummaryEditor && (
          <div className="bg-white border-b border-slate-200 p-4 sm:p-5 animate-slide-in flex-shrink-0">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Retrospective Summary & Agile Action Commitments
                  </h4>
                </div>
                <button
                  onClick={() => setShowSummaryEditor(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                placeholder="Write or review iteration key takeaways, root cause reflections, and commitments for the next iteration..."
                rows={4}
                className="w-full text-xs text-slate-800 bg-slate-50 rounded-xl p-3 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={handleSaveSummary}
                  className="btn-primary btn-sm text-xs bg-teal-600 hover:bg-teal-700"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RETROSPECTIVE BOARD (4-COLUMN KANBAN) */}
        <div className="flex-1 overflow-x-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 min-w-[700px] h-full items-start">
            {currentColumns.map((col) => {
              const Icon = col.icon;
              const columnItems = sprintRetroItems.filter((i) => i.category === col.key);
              const isAddingThis = activeAddCategory === col.key;

              return (
                <div
                  key={col.key}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col max-h-[calc(94vh-260px)] transition-all overflow-hidden"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b border-slate-100 flex items-center justify-between ${col.headerBg}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: col.accentColor }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-slate-900 truncate">
                            {col.title}
                          </h3>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${col.badgeBg}`}>
                            {columnItems.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate" title={col.subtitle}>
                          {col.subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (isAddingThis) {
                          setActiveAddCategory(null);
                        } else {
                          setActiveAddCategory(col.key);
                          setNewCardContent('');
                        }
                      }}
                      className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
                      title="Add feedback card"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inline Add Card Form */}
                  {isAddingThis && (
                    <div className="p-3 bg-slate-50/90 border-b border-slate-200 animate-slide-in">
                      <textarea
                        value={newCardContent}
                        onChange={(e) => setNewCardContent(e.target.value)}
                        placeholder={`What's on your mind? (e.g. ${
                          col.key === 'ACTION_ITEMS'
                            ? 'Set up OpenAPI automated docs in CI pipeline'
                            : col.key === 'KUDOS'
                            ? 'Great job by Priya on the auth refactor!'
                            : 'Standup meetings stayed punchy and on point'
                        })`}
                        rows={2}
                        className="w-full text-xs text-slate-800 bg-white rounded-lg p-2 border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                        autoFocus
                      />

                      {/* Action item specific metadata (Assignee & Due date) */}
                      {col.key === 'ACTION_ITEMS' && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={newActionAssigneeId}
                              onChange={(e) => setNewActionAssigneeId(e.target.value)}
                              className="text-[11px] bg-white border border-slate-300 rounded-lg p-1.5 flex-1"
                            >
                              <option value="">Select Action Owner...</option>
                              {users
                                .filter((u) => u.status === 'ACTIVE')
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.role.replace(/_/g, ' ')})
                                  </option>
                                ))}
                            </select>
                            <input
                              type="date"
                              value={newActionDueDate}
                              onChange={(e) => setNewActionDueDate(e.target.value)}
                              className="text-[11px] bg-white border border-slate-300 rounded-lg p-1.5"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={(e) => setIsAnonymous(e.target.checked)}
                            className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-slate-400" />
                            Anonymous
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveAddCategory(null)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateCard(col.key)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-600 text-white hover:bg-teal-700 shadow-2xs"
                          >
                            Add Card
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="p-3 space-y-2.5 overflow-y-auto flex-1 scrollbar-thin">
                    {columnItems.length === 0 && !isAddingThis ? (
                      <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-[11px] text-slate-400">No cards added yet.</p>
                        <button
                          onClick={() => setActiveAddCategory(col.key)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:underline"
                        >
                          <Plus className="w-3 h-3" />
                          Add first thought
                        </button>
                      </div>
                    ) : (
                      columnItems.map((item) => {
                        const hasVoted = item.votes.includes(currentUser?.id || 'u-pm-01');
                        const authorUser = users.find((u) => u.id === item.authorId);
                        const assigneeUser = users.find((u) => u.id === item.actionAssigneeId);

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group relative"
                          >
                            {/* Card Content */}
                            <p className="text-xs text-slate-800 leading-relaxed break-words font-medium">
                              {item.content}
                            </p>

                            {/* Action Item details banner */}
                            {col.key === 'ACTION_ITEMS' && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <div className="flex items-center gap-1.5">
                                    <UserCheck className="w-3 h-3 text-blue-600" />
                                    <span>Owner:</span>
                                    {assigneeUser ? (
                                      <span className="font-semibold text-slate-700">{assigneeUser.name}</span>
                                    ) : (
                                      <span className="text-slate-400 italic">Unassigned</span>
                                    )}
                                  </div>

                                  {item.actionDueDate && (
                                    <span className="text-slate-500">
                                      Due: {formatDate(item.actionDueDate)}
                                    </span>
                                  )}
                                </div>

                                {/* Status & Convert to Task */}
                                <div className="flex items-center justify-between gap-1 mt-1">
                                  <select
                                    value={item.actionItemStatus || 'TODO'}
                                    onChange={(e) =>
                                      updateRetroActionItem(item.id, {
                                        actionItemStatus: e.target.value as RetroActionStatus,
                                      })
                                    }
                                    className="text-[10px] font-bold bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700"
                                  >
                                    <option value="TODO">To Do</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="DONE">Done</option>
                                  </select>

                                  {item.convertedTaskId ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Task Created
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleConvertToTask(item)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200 transition-colors"
                                      title="Convert this action item into an actual task in the project"
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                      Convert to Task
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Card Footer: Author, Votes & Delete */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {item.isAnonymous ? (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Shield className="w-3 h-3 text-slate-400" />
                                    <span>Anonymous</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-600 truncate">
                                    {authorUser && (
                                      <Avatar
                                        name={authorUser.name}
                                        color={authorUser.avatarColor}
                                        size="xs"
                                      />
                                    )}
                                    <span className="truncate">{item.authorName}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {/* Upvote Button */}
                                <button
                                  type="button"
                                  onClick={() => handleVote(item.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    hasVoted
                                      ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                  title="Upvote card"
                                >
                                  <ThumbsUp className={`w-3 h-3 ${hasVoted ? 'text-teal-600 fill-teal-600' : ''}`} />
                                  <span>{item.votes.length}</span>
                                </button>

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remove card"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>
              Retrospectives foster continuous improvement. Cards and action items are saved directly to project history.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="btn-primary text-xs px-5 py-2 bg-slate-900 hover:bg-slate-800"
            >
              Done & Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
