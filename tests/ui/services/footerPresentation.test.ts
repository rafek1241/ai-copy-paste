import { describe, it, expect } from 'vitest';
import { buildFooterPresentation } from '@/services/footerPresentation';

describe('footerPresentation service', () => {
  it('returns scheduled update presentation while preserving redaction info', () => {
    const result = buildFooterPresentation({
      tokenCount: 900,
      tokenLimit: 1000,
      redactionCount: 2,
      updateStatus: 'scheduled',
    });

    expect(result.showUpdateScheduledBadge).toBe(true);
    expect(result.showTokenUsage).toBe(false);
    expect(result.updateScheduledText).toBe('Update will install on exit');
    expect(result.redactionText).toBe('2 redacted');
    expect(result.redactionTitle).toBe('2 sensitive items redacted');
  });

  it('returns token usage presentation when update is not scheduled', () => {
    const result = buildFooterPresentation({
      tokenCount: 850,
      tokenLimit: 1000,
      redactionCount: 0,
      updateStatus: 'available',
    });

    expect(result.showUpdateScheduledBadge).toBe(false);
    expect(result.showTokenUsage).toBe(true);
    expect(result.tokenStatusClassName).toBe('bg-orange-500');
    expect(result.tokenUsageText).toBe('850 / 1,000 tokens');
    expect(result.redactionText).toBeNull();
  });
});
