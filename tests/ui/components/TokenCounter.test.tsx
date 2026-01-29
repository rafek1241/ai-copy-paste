import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenCounter } from '@/components/TokenCounter';
import * as tokenizerService from '@/services/tokenizer';
import { useTokenCount } from '@/hooks/useTokenCount';

// Mock tokenizer service
vi.mock('@/services/tokenizer', () => ({
  countTokens: vi.fn(),
  formatTokenCount: (n: number) => n.toString(),
  calculateTokenPercentage: (u: number, l: number) => (l > 0 ? (u / l) * 100 : 0),
  getTokenLimitColor: (p: number) => (p >= 90 ? '#ff4444' : '#44ff44'),
  TOKEN_LIMITS: {
    'gpt-4o': 100,
  },
}));

// Mock useTokenCount hook
vi.mock('@/hooks/useTokenCount', () => ({
  useTokenCount: vi.fn(),
}));

describe('TokenCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTokenCount).mockReturnValue({ totalTokens: 0, isCalculating: false });
    vi.mocked(tokenizerService.countTokens).mockReturnValue(0);
  });

  it('should display zero tokens initially', () => {
    render(<TokenCounter text="" />);
    expect(screen.getByText('0')).toBeDefined();
  });

  it('should count tokens for text', async () => {
    vi.mocked(tokenizerService.countTokens).mockReturnValue(10);
    render(<TokenCounter text="Hello world" />);
    
    await waitFor(() => {
      expect(screen.getByText('10')).toBeDefined();
    });
  });

  it('should combine text and file tokens', async () => {
    vi.mocked(tokenizerService.countTokens).mockReturnValue(10);
    vi.mocked(useTokenCount).mockReturnValue({ totalTokens: 50, isCalculating: false });
    
    render(<TokenCounter text="Hello" selectedFilePaths={['/path/1', '/path/2']} />);
    
    await waitFor(() => {
      expect(screen.getByText('60')).toBeDefined();
    });
  });

  it('should show warning when approaching limit', async () => {
    vi.mocked(tokenizerService.countTokens).mockReturnValue(95);
    render(<TokenCounter text="Long text" modelName="gpt-4o" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Warning: Approaching token limit/i)).toBeDefined();
    });
  });

  it('should show loading state while calculating', () => {
    vi.mocked(useTokenCount).mockReturnValue({ totalTokens: 0, isCalculating: true });
    render(<TokenCounter text="" selectedFilePaths={['/path/1']} />);
    
    expect(screen.getByText('...')).toBeDefined();
  });

  it('should render compact variant correctly', async () => {
    vi.mocked(tokenizerService.countTokens).mockReturnValue(100);
    render(<TokenCounter text="test" variant="compact" />);
    expect(screen.getByText('Tokens:')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('100')).toBeDefined();
    });
  });
});
