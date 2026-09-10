export type Role = 'user' | 'assistant' | 'system';

export interface MessageExecutionContext {
  modelId: string;
  modelRevision: string;
  runtimeVersion: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  /** Memory-only identity of the runtime/model that produced this response. */
  executionContext?: MessageExecutionContext;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  lastUpdated: number;
}
