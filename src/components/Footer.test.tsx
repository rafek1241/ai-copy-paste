import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { buildFooterPresentation } from '@/services/footerPresentation';

function renderFooter(overrides?: Partial<Parameters<typeof buildFooterPresentation>[0]>, version = '1.0.0') {
  const presentation = buildFooterPresentation({
    tokenCount: 100,
    tokenLimit: 1000,
    redactionCount: 0,
    ...overrides,
  });

  return render(
    <Footer
      onCopy={() => {}}
      version={version}
      presentation={presentation}
    />
  );
}

describe('Footer', () => {
  describe('version display', () => {
    it('should display version with "v" prefix', () => {
      renderFooter(undefined, '1.2.3');

      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });

    it('should display version 0.0.0 when fallback is provided', () => {
      renderFooter(undefined, '0.0.0');

      expect(screen.getByText('v0.0.0')).toBeInTheDocument();
    });

    it('should display version in bottom-right corner', () => {
      const { container } = renderFooter(undefined, '2.0.0');

      const footer = container.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('token count display', () => {
    it('should display token count with formatting', () => {
      renderFooter({ tokenCount: 1234, tokenLimit: 10000 });

      expect(screen.getByText(/1,234/)).toBeInTheDocument();
      expect(screen.getByText(/10,000/)).toBeInTheDocument();
    });

    it('should display zero tokens correctly', () => {
      renderFooter({ tokenCount: 0, tokenLimit: 1000 });

      expect(screen.getByText('0 / 1,000 tokens')).toBeInTheDocument();
    });
  });

  describe('status color', () => {
    it('should show green status when under 80% of limit', () => {
      const { container } = renderFooter({ tokenCount: 500, tokenLimit: 1000 });

      const statusDot = container.querySelector('.bg-green-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show orange status when at or above 80% of limit', () => {
      const { container } = renderFooter({ tokenCount: 800, tokenLimit: 1000 });

      const statusDot = container.querySelector('.bg-orange-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show red status when at or above 100% of limit', () => {
      const { container } = renderFooter({ tokenCount: 1000, tokenLimit: 1000 });

      const statusDot = container.querySelector('.bg-red-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show red status when over limit', () => {
      const { container } = renderFooter({ tokenCount: 1500, tokenLimit: 1000 });

      const statusDot = container.querySelector('.bg-red-500');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('copy button', () => {
    it('should call onCopy when button is clicked', () => {
      const onCopy = vi.fn();
      const presentation = buildFooterPresentation({
        tokenCount: 100,
        tokenLimit: 1000,
        redactionCount: 0,
      });
      render(
        <Footer
          onCopy={onCopy}
          version="1.0.0"
          presentation={presentation}
        />
      );

      const button = screen.getByRole('button', { name: /copy context/i });
      button.click();

      expect(onCopy).toHaveBeenCalledTimes(1);
    });
  });

  describe('mixed state rendering', () => {
    it('shows scheduled update badge and keeps redaction badge visible', () => {
      renderFooter({ updateStatus: 'scheduled', redactionCount: 2 });

      expect(screen.getByTestId('update-scheduled-badge')).toBeInTheDocument();
      expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
      expect(screen.getByText('2 redacted')).toBeInTheDocument();
    });
  });
});
