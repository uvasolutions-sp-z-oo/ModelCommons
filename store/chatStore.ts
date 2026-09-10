import { create } from 'zustand';
import type { ChatSession, MessageExecutionContext, Role } from '../types';

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  actions: {
    createNewSession: () => string;
    addMessage: (sessionId: string, role: Role, content: string, executionContext?: MessageExecutionContext) => void;
    deleteSession: (sessionId: string) => void;
    selectSession: (sessionId: string) => void;
    clearAllSessions: () => void;
  };
}

/** Chats are memory-only. ModelCommons persists model/runtime metadata, never
 * prompts or responses, unless a future UI adds an explicit opt-in store. */
export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSessionId: null,
  actions: {
    createNewSession: () => {
      const id = generateId('chat');
      const now = Date.now();
      set((state) => ({
        sessions: [{ id, title: 'New local chat', messages: [], createdAt: now, lastUpdated: now }, ...state.sessions],
        currentSessionId: id,
      }));
      return id;
    },
    addMessage: (sessionId, role, content, executionContext) => set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        const now = Date.now();
        const firstUserMessage = session.messages.length === 0 && role === 'user';
        return {
          ...session,
          title: firstUserMessage
            ? `${content.slice(0, 36)}${content.length > 36 ? '…' : ''}`
            : session.title,
          lastUpdated: now,
          messages: [...session.messages, {
            id: generateId('message'),
            role,
            content,
            timestamp: now,
            ...(role === 'assistant' && executionContext ? { executionContext } : {}),
          }],
        };
      }).sort((a, b) => b.lastUpdated - a.lastUpdated),
    })),
    deleteSession: (sessionId) => set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
      currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
    })),
    selectSession: (currentSessionId) => set({ currentSessionId }),
    clearAllSessions: () => set({ sessions: [], currentSessionId: null }),
  },
}));
