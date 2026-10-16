import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Minimize2,
  Maximize2,
  Zap,
  Sparkles,
  Paperclip,
  Check
} from 'lucide-react';
import { useChatStore } from '../../../store/chatStore';
import { useAuthStore } from '../../../store/authStore';
import { Avatar } from '../../../components/common/Avatar';

interface ProjectChatDrawerProps {
  projectId: string;
  projectName: string;
  onOpenFullTab: () => void;
}

export const ProjectChatDrawer: React.FC<ProjectChatDrawerProps> = ({
  projectId,
  projectName,
  onOpenFullTab,
}) => {
  const { currentUser } = useAuthStore();
  const { messages, sendMessage, simulateTeammateReply, typingUsers } = useChatStore();

  const [isOpen, setIsOpen] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectMessages = messages[projectId] || [];
  const currentTyping = typingUsers[projectId] || [];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, projectMessages.length]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim()) return;

    sendMessage(projectId, inputContent.trim());
    setInputContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {!isOpen ? (
        /* Floating Chat Launcher Pill */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-slate-700/80 group"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-brand-400 group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <span className="text-xs font-bold font-display">Project Chat</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
            {projectMessages.length}
          </span>
        </button>
      ) : (
        /* Floating Chat Box */
        <div className="w-80 sm:w-96 h-[540px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-400 flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{projectName} Live Chat</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-time channel</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => simulateTeammateReply(projectId)}
                className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Simulate teammate reply"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenFullTab();
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Open full-screen chat tab"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-slate-50/50">
            {projectMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                <span>No messages in this channel yet. Say hi to your team!</span>
              </div>
            ) : (
              projectMessages.map((msg) => {
                const isMe = msg.userId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-700">
                          {msg.senderName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                        isMe
                          ? 'bg-brand-600 text-white rounded-br-xs'
                          : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {currentTyping.length > 0 && (
            <div className="px-4 py-1 text-[11px] text-slate-500 bg-white border-t border-slate-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span>{currentTyping.join(', ')} is typing...</span>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type message..."
              className="input text-xs py-2 h-9 flex-1"
            />
            <button
              type="submit"
              disabled={!inputContent.trim()}
              className="btn-primary p-0 h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
