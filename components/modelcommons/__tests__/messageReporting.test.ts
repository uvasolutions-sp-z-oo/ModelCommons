import { describe, expect, it } from 'vitest';
import type { Message } from '../../../types';
import { canReportMessage } from '../messageReporting';

const message = (role: Message['role'], id = 'persisted'): Message => ({ id, role, content: 'text', timestamp: 1 });

describe('report action visibility', () => {
  it('allows only assistant messages whose parent supplies the persisted-message callback', () => {
    expect(canReportMessage(message('assistant'), true)).toBe(true);
    expect(canReportMessage(message('assistant', 'streaming'), false)).toBe(false);
    expect(canReportMessage(message('user'), true)).toBe(false);
    expect(canReportMessage(message('system'), true)).toBe(false);
  });
});
