import React, { useRef, useState } from 'react';
import type { Task, CommentAttachment } from '../../types';
import { MessageSquare, History, Send, FileIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../common/Avatar';
import { ActivityFeed } from '../common/ActivityFeed';
import { RichTextEditor, CommentContent } from '../common/RichTextEditor';
import { IssueSection } from './IssueSection';
import { formatDate, formatTimeAgo } from '../../utils/dateUtils';
import { formatFileSize, validateFile, detectDuplicateFile } from '../../utils/fileConfig';
import { isEmptyHtml } from '../../utils/sanitize';
import { buildProjectTeamMembers } from '../../utils/sprintIssues';

interface ActivityPanelProps {
  task: Task;
  defaultOpen?: boolean;
}

/** Comments + change history for an issue. */
export const ActivityPanel: React.FC<ActivityPanelProps> = ({ task, defaultOpen = true }) => {
  const { users, projects, teams, activities, addComment } = useAppStore();
  const { currentUser } = useAuthStore();

  // People you can @mention in a comment: this issue's project team.
  const mentionableUsers = buildProjectTeamMembers(
    projects.find((p) => p.id === task.projectId),
    teams,
    users
  );

  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [commentHtml, setCommentHtml] = useState('');
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const history = activities.filter(
    (a) => a.entityId === task.id && (a.entityType === 'TASK' || a.entityType === 'INITIATIVE')
  );

  const submit = () => {
    if (isEmptyHtml(commentHtml) || !currentUser) return;
    addComment(task.id, currentUser.id, commentHtml, attachments);
    setCommentHtml('');
    setAttachments([]);
    toast.success('Comment added');
  };

  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const existing = attachments.map((a) => ({ fileName: a.fileName, fileSize: a.fileSize }));
    const added: CommentAttachment[] = [];

    Array.from(files).forEach((file) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Invalid file');
        return;
      }
      const duplicate = detectDuplicateFile(file.name, file.size, existing);
      if (duplicate.isDuplicate) {
        toast.error(`"${file.name}" is already attached`);
        return;
      }
      added.push({
        fileId: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        attachedAt: new Date().toISOString(),
      });
      existing.push({ fileName: file.name, fileSize: file.size });
    });

    if (added.length > 0) setAttachments((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tabButton = (key: 'comments' | 'history', label: string, icon: React.ReactNode, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
        tab === key ? 'bg-white text-[#0f766e] border border-[#99f6e4] shadow-fe-xs' : 'text-slate-500 hover:text-slate-700 border border-transparent'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === key ? 'bg-[#ccfbf1]' : 'bg-slate-100'}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <IssueSection
      title="Activity"
      icon={<MessageSquare className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      action={
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-0.5 rounded-lg">
          {tabButton('comments', 'Comments', <MessageSquare className="w-3 h-3" />, task.comments.length)}
          {tabButton('history', 'History', <History className="w-3 h-3" />, history.length)}
        </div>
      }
    >
      {tab === 'history' ? (
        <ActivityFeed activities={history} limit={25} showProjectBadge={false} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {task.comments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No comments yet. Start the discussion.</p>
            ) : (
              task.comments.map((comment) => {
                const author = users.find((u) => u.id === comment.userId);
                return (
                  <div key={comment.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e5ea]">
                    <Avatar name={author?.name || 'User'} color={author?.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs font-semibold text-slate-800">{author?.name || 'Unknown user'}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0" title={formatDate(comment.createdAt)}>
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <CommentContent html={comment.content} />
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {comment.attachments.map((att) => (
                            <div
                              key={att.fileId}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#e2e5ea] text-xs"
                            >
                              <FileIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="font-medium text-slate-700 truncate">{att.fileName}</span>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">{formatFileSize(att.fileSize)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <RichTextEditor
              content={commentHtml}
              onChange={setCommentHtml}
              onSubmit={submit}
              placeholder="Write a comment..."
              mentionableUsers={mentionableUsers}
              onFileSelect={() => fileInputRef.current?.click()}
            />
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesAdded} />
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div key={att.fileId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f8fafc] border border-[#e2e5ea] text-xs">
                    <FileIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-700 truncate flex-1">{att.fileName}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatFileSize(att.fileSize)}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.fileId !== att.fileId))}
                      className="p-0.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={submit} className="btn-primary btn-sm" disabled={isEmptyHtml(commentHtml)}>
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </IssueSection>
  );
};
