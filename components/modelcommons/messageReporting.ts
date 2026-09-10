import type { Message } from '../../types';

/** The parent provides a callback only for persisted, completed responses. */
export function canReportMessage(message: Message, callbackAvailable: boolean): boolean {
  return message.role === 'assistant' && callbackAvailable;
}
