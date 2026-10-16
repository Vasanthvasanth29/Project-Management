import type { Role } from './index';

export interface ChatReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface ChatAttachment {
  name: string;
  size: string;
  type: string;
  url?: string;
}

export interface ProjectChatMessage {
  id: string;
  projectId: string;
  userId: string;
  senderName: string;
  senderRole: Role;
  senderAvatarColor: string;
  senderAvatarUrl?: string;
  content: string;
  createdAt: string;
  pinned?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions?: ChatReaction[];
  attachments?: ChatAttachment[];
}

export interface ProjectChatChannel {
  id: string;
  projectId: string;
  name: string;
  topic?: string;
  isDefault?: boolean;
}
