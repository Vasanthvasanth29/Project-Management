import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Pin,
  Reply,
  Trash2,
  Search,
  Users,
  MessageSquare,
  Zap,
  Sparkles,
  ChevronDown,
  X,
  Check,
  CornerDownRight,
  Hash,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useChatStore } from '../../../store/chatStore';
import { useAuthStore } from '../../../store/authStore';
import { useAppStore } from '../../../store/appStore';
import { Avatar } from '../../../components/common/Avatar';
import { RoleBadge } from '../../../components/common/Badges';
import type { ProjectChatMessage } from '../../../types/chat';
import { toast } from 'sonner';

interface ProjectChatTabProps {
  projectId: string;
}

const EMOJIS = ['👍', '❤️', '🚀', '👀', '🎉', '🔥', '✅', '🙌'];

export const ProjectChatTab: React.FC<ProjectChatTabProps> = ({ projectId }) => {
  const { currentUser } = useAuthStore();
  const { projects, users } = useAppStore();
  const {
    messages,
    sendMessage,
    toggleReaction,
    pinMessage,
    deleteMessage,
    typingUsers,
    simulateTeammateReply,
  } = useChatStore();

  const project = projects.find((p) => p.id === projectId);
  const projectMessages = messages[projectId] || [];

  const [inputContent, setInputContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<ProjectChatMessage | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [projectMessages.length]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim()) return;

    sendMessage(
      projectId,
      inputContent,
      replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            content: replyingTo.content.slice(0, 60),
          }
        : undefined
    );

    setInputContent('');
    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentTyping = typingUsers[projectId] || [];
  const pinnedMessages = projectMessages.filter((m) => m.pinned);

  const filteredMessages = projectMessages.filter((m) => {
    if (showPinnedOnly && !m.pinned) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const projectMembers = users.filter((u) => {
    if (u.id === project?.projectManagerId) return true;
    if (project?.teamIds.includes(u.teamId || '')) return true;
    return false;
  });

  const formatMessageTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="card h-[750px] flex flex-col rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white animate-fade-in">
      {/* Top Channel Bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-white flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center font-bold">
            <Hash className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 font-display">
                {project?.name || 'Project'} Team Chat
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Channel
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dedicated channel for project discussions, iteration decisions, and technical updates
            </p>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2.5">
          {/* Search messages */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat..."
              className="input text-xs pl-8 py-1.5 h-8 w-36 sm:w-48 bg-slate-50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Pinned filter toggle */}
          {pinnedMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`btn-sm flex items-center gap-1.5 ${
                showPinnedOnly ? 'btn-primary' : 'btn-secondary text-slate-700'
              }`}
              title="Filter pinned announcements"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{pinnedMessages.length} Pinned</span>
            </button>
          )}

          {/* Simulate Teammate Reply Button */}
          <button
            type="button"
            onClick={() => simulateTeammateReply(projectId)}
            className="btn-secondary btn-sm flex items-center gap-1.5 text-brand-600 border-brand-200 hover:bg-brand-50"
            title="Simulate teammate response in project live chat"
          >
            <Zap className="w-3.5 h-3.5 text-brand-600" />
            <span className="hidden sm:inline">Simulate Reply</span>
          </button>
        </div>
      </div>

      {/* Pinned Announcement Strip */}
      {pinnedMessages.length > 0 && !showPinnedOnly && (
        <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-700 flex-shrink-0">
              Pinned:
            </span>
            <span className="truncate font-medium">
              {pinnedMessages[pinnedMessages.length - 1].content.slice(0, 100)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPinnedOnly(true)}
            className="text-[11px] font-bold text-amber-700 hover:underline flex-shrink-0 ml-2"
          >
            View all ({pinnedMessages.length})
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No messages found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {showPinnedOnly
                ? 'No pinned messages in this project.'
                : 'Start the conversation with your team about iteration goals, milestones, or code reviews.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isMe = msg.userId === currentUser?.id;
            const prevMsg = filteredMessages[index - 1];
            const showDateHeader =
              !prevMsg || formatMessageDate(prevMsg.createdAt) !== formatMessageDate(msg.createdAt);

            return (
              <React.Fragment key={msg.id}>
                {showDateHeader && (
                  <div className="flex items-center justify-center my-4">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-slate-100 text-slate-500 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mx-2">
                      {formatMessageDate(msg.createdAt)}
                    </span>
                    <div className="border-t border-slate-200 w-full" />
                  </div>
                )}

                <div
                  className={`group relative flex items-start gap-3 p-3 rounded-2xl transition-all ${
                    msg.pinned ? 'bg-amber-50/50 border border-amber-200/60' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <Avatar
                    name={msg.senderName}
                    color={msg.senderAvatarColor}
                    size="md"
                    className="flex-shrink-0 mt-0.5"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{msg.senderName}</span>
                      <RoleBadge role={msg.senderRole} />
                      <span className="text-[10px] text-slate-400">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                      {msg.pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.2 rounded">
                          <Pin className="w-2.5 h-2.5" /> Pinned
                        </span>
                      )}
                    </div>

                    {/* Quoted Reply Preview */}
                    {msg.replyTo && (
                      <div className="mt-1.5 p-2 rounded-xl bg-slate-100/80 border-l-2 border-brand-500 text-xs text-slate-600 flex items-start gap-1.5">
                        <CornerDownRight className="w-3.5 h-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-slate-800">
                            {msg.replyTo.senderName}:
                          </span>{' '}
                          {msg.replyTo.content}
                        </div>
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="text-xs text-slate-800 mt-1 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Reactions Display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.reactions.map((r) => {
                          const hasReacted = currentUser ? r.userIds.includes(currentUser.id) : false;
                          return (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() =>
                                currentUser &&
                                toggleReaction(projectId, msg.id, r.emoji, currentUser.id)
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                                hasReacted
                                  ? 'bg-brand-50 border border-brand-300 text-brand-700 shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span className="text-[11px]">{r.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hover Action Bar */}
                  <div className="absolute right-3 top-2 hidden group-hover:flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm z-10 animate-fade-in">
                    {/* Quick Emojis */}
                    {EMOJIS.slice(0, 3).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          currentUser && toggleReaction(projectId, msg.id, emoji, currentUser.id)
                        }
                        className="p-1 hover:bg-slate-100 rounded-lg text-xs"
                      >
                        {emoji}
                      </button>
                    ))}

                    <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

                    {/* Reply */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(msg);
                        textareaRef.current?.focus();
                      }}
                      className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg"
                      title="Reply in thread"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Pin */}
                    <button
                      type="button"
                      onClick={() => pinMessage(projectId, msg.id)}
                      className={`p-1 rounded-lg ${
                        msg.pinned
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
                      }`}
                      title={msg.pinned ? 'Unpin message' : 'Pin to channel'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete (if author or admin) */}
                    {(isMe || currentUser?.role === 'ADMIN') && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(projectId, msg.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {currentTyping.length > 0 && (
        <div className="px-6 py-1.5 text-xs text-slate-500 flex items-center gap-2 bg-slate-50 border-t border-slate-100">
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]" />
          </span>
          <span className="font-semibold text-slate-700">
            {currentTyping.join(', ')}
          </span>{' '}
          {currentTyping.length === 1 ? 'is typing...' : 'are typing...'}
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-6 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
            <span>Replying to</span>
            <span className="font-bold text-slate-900">{replyingTo.senderName}:</span>
            <span className="truncate italic text-slate-500">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Prompt Starter Chips */}
      <div className="px-6 pt-2 pb-1 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex-shrink-0">
          Quick Starters:
        </span>
        {[
          '🚀 Iteration milestone update',
          '🔍 Code review requested',
          '⚠️ Blocker escalation',
          '✅ Tests passing on staging',
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setInputContent(chip + ': ')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-[11px] font-medium text-slate-600 transition-all flex-shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Composer */}
      <form onSubmit={handleSend} className="p-4 pt-2 bg-white flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${project?.name || 'project'} team... (Press Enter to send, Shift+Enter for new line)`}
            className="input text-xs w-full resize-none pr-20 py-2.5 rounded-2xl"
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            {/* Quick Emoji Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowEmojiPickerFor(showEmojiPickerFor === 'composer' ? null : 'composer')
                }
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              {showEmojiPickerFor === 'composer' && (
                <div className="absolute bottom-full right-0 mb-2 p-2 rounded-2xl bg-white border border-slate-200 shadow-xl grid grid-cols-4 gap-1 z-30 animate-scale-in">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setInputContent((prev) => prev + emoji);
                        setShowEmojiPickerFor(null);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-xl text-sm"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toast.info('Attachments enabled. Select image or document.')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              title="Attach document or asset"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!inputContent.trim()}
          className="btn-primary rounded-2xl h-11 w-11 p-0 flex items-center justify-center flex-shrink-0 shadow-sm"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
