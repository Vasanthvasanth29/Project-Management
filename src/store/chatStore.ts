import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectChatMessage, ProjectChatChannel, ChatReaction } from '../types/chat';
import type { Role } from '../types';
import { useAuthStore } from './authStore';
import { useAppStore } from './appStore';

interface ChatState {
  messages: Record<string, ProjectChatMessage[]>;
  channels: Record<string, ProjectChatChannel[]>;
  activeChannel: Record<string, string>;
  typingUsers: Record<string, string[]>;
  unreadCounts: Record<string, number>;

  // Actions
  sendMessage: (
    projectId: string,
    content: string,
    replyTo?: { id: string; senderName: string; content: string },
    attachments?: { name: string; size: string; type: string; url?: string }[]
  ) => void;
  toggleReaction: (projectId: string, messageId: string, emoji: string, userId: string) => void;
  pinMessage: (projectId: string, messageId: string) => void;
  deleteMessage: (projectId: string, messageId: string) => void;
  setActiveChannel: (projectId: string, channelId: string) => void;
  markProjectChatRead: (projectId: string) => void;
  simulateTeammateReply: (projectId: string, contextPrompt?: string) => void;
}

const defaultChannels = (projectId: string): ProjectChatChannel[] => [
  {
    id: `${projectId}-ch-general`,
    projectId,
    name: 'general-discussion',
    topic: 'Main channel for project updates, announcements, and team standup',
    isDefault: true,
  },
  {
    id: `${projectId}-ch-arch`,
    projectId,
    name: 'architecture-sync',
    topic: 'API design, database schemas, and technical RFCs',
  },
  {
    id: `${projectId}-ch-qa`,
    projectId,
    name: 'bugs-and-releases',
    topic: 'Release candidates, staging validation, and blocker escalations',
  },
];

const initialSeedMessages: Record<string, ProjectChatMessage[]> = {
  'proj-001': [
    {
      id: 'msg-001-1',
      projectId: 'proj-001',
      userId: 'u-pm-01',
      senderName: 'Rahul Kumar',
      senderRole: 'PROJECT_MANAGER',
      senderAvatarColor: '#2563eb',
      content: 'Welcome everyone to the **Core Banking Portal** project channel! 🚀\n\nPlease review the sprint backlog before our 10:00 AM sync.',
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      pinned: true,
      reactions: [
        { emoji: '👋', count: 3, userIds: ['u-admin-01', 'u-tl-01', 'u-m-01'] },
        { emoji: '🚀', count: 2, userIds: ['u-admin-01', 'u-tl-01'] },
      ],
    },
    {
      id: 'msg-001-2',
      projectId: 'proj-001',
      userId: 'u-tl-01',
      senderName: 'Arun Kumar',
      senderRole: 'TEAM_LEADER',
      senderAvatarColor: '#0f766e',
      content: 'Morning Rahul! The OAuth2 token refresh flow and SSO endpoints are in Code Review. Testing pipeline has passed 100% of unit tests.',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      reactions: [{ emoji: '👍', count: 2, userIds: ['u-pm-01', 'u-admin-01'] }],
    },
    {
      id: 'msg-001-3',
      projectId: 'proj-001',
      userId: 'u-admin-01',
      senderName: 'Sarah Mitchell',
      senderRole: 'ADMIN',
      senderAvatarColor: '#172554',
      content: 'Great work team. Security audit passed with zero high-severity findings. Ready for staging deployment once PM approves.',
      createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      reactions: [{ emoji: '🎉', count: 4, userIds: ['u-pm-01', 'u-tl-01', 'u-m-01', 'u-pm-02'] }],
    },
  ],
  'proj-002': [
    {
      id: 'msg-002-1',
      projectId: 'proj-002',
      userId: 'u-pm-01',
      senderName: 'Rahul Kumar',
      senderRole: 'PROJECT_MANAGER',
      senderAvatarColor: '#2563eb',
      content: 'Mobile Banking App Sprint 3 kickoff thread. Focus for this week is Biometric authentication and push notifications.',
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      pinned: true,
    },
  ],
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: initialSeedMessages,
      channels: {},
      activeChannel: {},
      typingUsers: {},
      unreadCounts: {},

      sendMessage: (projectId, content, replyTo, attachments) => {
        const currentUser = useAuthStore.getState().currentUser;
        if (!currentUser || !content.trim()) return;

        const newMessage: ProjectChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId,
          userId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          senderAvatarColor: currentUser.avatarColor,
          senderAvatarUrl: currentUser.avatarUrl,
          content: content.trim(),
          createdAt: new Date().toISOString(),
          replyTo,
          attachments,
          reactions: [],
        };

        set((state) => {
          const currentMsgs = state.messages[projectId] || [];
          return {
            messages: {
              ...state.messages,
              [projectId]: [...currentMsgs, newMessage],
            },
          };
        });

        // Add to project audit activities
        useAppStore.getState().addActivity({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          projectId,
          action: 'posted in project live chat',
          entityType: 'PROJECT',
          entityId: projectId,
          entityTitle: content.slice(0, 45) + (content.length > 45 ? '...' : ''),
          createdAt: new Date().toISOString(),
        });
      },

      toggleReaction: (projectId, messageId, emoji, userId) => {
        set((state) => {
          const projectMsgs = state.messages[projectId] || [];
          const updated = projectMsgs.map((m) => {
            if (m.id !== messageId) return m;

            const reactions = [...(m.reactions || [])];
            const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

            if (existingIdx >= 0) {
              const existing = reactions[existingIdx];
              const hasReacted = existing.userIds.includes(userId);

              if (hasReacted) {
                const newUserIds = existing.userIds.filter((id) => id !== userId);
                if (newUserIds.length === 0) {
                  reactions.splice(existingIdx, 1);
                } else {
                  reactions[existingIdx] = {
                    ...existing,
                    count: newUserIds.length,
                    userIds: newUserIds,
                  };
                }
              } else {
                reactions[existingIdx] = {
                  ...existing,
                  count: existing.count + 1,
                  userIds: [...existing.userIds, userId],
                };
              }
            } else {
              reactions.push({
                emoji,
                count: 1,
                userIds: [userId],
              });
            }

            return { ...m, reactions };
          });

          return {
            messages: {
              ...state.messages,
              [projectId]: updated,
            },
          };
        });
      },

      pinMessage: (projectId, messageId) => {
        set((state) => {
          const projectMsgs = state.messages[projectId] || [];
          return {
            messages: {
              ...state.messages,
              [projectId]: projectMsgs.map((m) =>
                m.id === messageId ? { ...m, pinned: !m.pinned } : m
              ),
            },
          };
        });
      },

      deleteMessage: (projectId, messageId) => {
        set((state) => {
          const projectMsgs = state.messages[projectId] || [];
          return {
            messages: {
              ...state.messages,
              [projectId]: projectMsgs.filter((m) => m.id !== messageId),
            },
          };
        });
      },

      setActiveChannel: (projectId, channelId) => {
        set((state) => ({
          activeChannel: {
            ...state.activeChannel,
            [projectId]: channelId,
          },
        }));
      },

      markProjectChatRead: (projectId) => {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [projectId]: 0,
          },
        }));
      },

      simulateTeammateReply: (projectId, contextPrompt) => {
        const potentialSenders = [
          {
            name: 'Sarah Mitchell',
            role: 'ADMIN' as Role,
            avatarColor: '#172554',
            replies: [
              'Approved from security standpoint! Pipeline is looking green.',
              'I have verified the federation logs and everything checked out.',
              'Great milestone progress. Let me know if staging credentials need refreshing.',
            ],
          },
          {
            name: 'Arun Kumar',
            role: 'TEAM_LEADER' as Role,
            avatarColor: '#0f766e',
            replies: [
              'Got it! Assigning this to sprint backlog now.',
              'Pull request is up and all integration tests passed on branch.',
              'Reviewed the transition criteria — looks good to move forward.',
            ],
          },
          {
            name: 'Rahul Kumar',
            role: 'PROJECT_MANAGER' as Role,
            avatarColor: '#2563eb',
            replies: [
              'Thanks for the update! Sprint burndown velocity is right on track.',
              'Added to our sprint demo agenda for tomorrow.',
              'Acknowledged. Let me notify the stakeholders right away.',
            ],
          },
        ];

        const sender = potentialSenders[Math.floor(Math.random() * potentialSenders.length)];
        const replyText =
          contextPrompt || sender.replies[Math.floor(Math.random() * sender.replies.length)];

        // Set typing indicator
        set((state) => ({
          typingUsers: {
            ...state.typingUsers,
            [projectId]: [...(state.typingUsers[projectId] || []), sender.name],
          },
        }));

        // After 1.4s, send message and clear typing indicator
        setTimeout(() => {
          const replyMessage: ProjectChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            projectId,
            userId: `u-sim-${sender.name.toLowerCase().replace(/\s+/g, '-')}`,
            senderName: sender.name,
            senderRole: sender.role,
            senderAvatarColor: sender.avatarColor,
            content: replyText,
            createdAt: new Date().toISOString(),
            reactions: [{ emoji: '👍', count: 1, userIds: ['system'] }],
          };

          set((state) => {
            const currentMsgs = state.messages[projectId] || [];
            const activeTyping = (state.typingUsers[projectId] || []).filter(
              (name) => name !== sender.name
            );
            return {
              messages: {
                ...state.messages,
                [projectId]: [...currentMsgs, replyMessage],
              },
              typingUsers: {
                ...state.typingUsers,
                [projectId]: activeTyping,
              },
            };
          });
        }, 1400);
      },
    }),
    {
      name: 'flowexec-project-chat',
    }
  )
);
