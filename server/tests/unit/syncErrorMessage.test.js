import { describe, expect, it } from 'vitest';
import { syncErrorMessage } from '../../src/utils/syncErrorMessage.js';

describe('syncErrorMessage', () => {
  it('extracts object and array job-log errors', () => {
    expect(syncErrorMessage({ message: 'Actor failed: website unavailable' })).toBe('Actor failed: website unavailable');
    expect(syncErrorMessage([{ error: 'Download failed' }, { message: 'PDF unreadable' }])).toBe('Download failed; PDF unreadable');
    expect(syncErrorMessage(null)).toBeNull();
  });
  it('omits technical stacks while retaining the first message', () => {
    expect(syncErrorMessage({ message: 'PDF download failed\n at download (/private/source.js:1)' })).toBe('PDF download failed');
    expect(syncErrorMessage({ message: 'PrismaClient failure' })).not.toContain('PrismaClient');
  });
});