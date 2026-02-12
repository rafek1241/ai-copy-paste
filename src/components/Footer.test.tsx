import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer', () => {
  describe('version display', () => {
    it('should display version with "v" prefix', () => {
      render(
        <Footer
          onCopy={() => {}}
          tokenCount={100}
          tokenLimit={1000}
          version="1.2.3"
        />
      );

      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });

    it('should display version 0.0.0 when fallback is provided', () => {
      render(
        <Footer
          onCopy={() => {}}
          tokenCount={0}
          tokenLimit={1000}
          version="0.0.0"
        />
      );

      expect(screen.getByText('v0.0.0')).toBeInTheDocument();
    });

    it('should display version in bottom-right corner', () => {
      const { container } = render(
        <Footer
          onCopy={() => {}}
          tokenCount={100}
          tokenLimit={1000}
          version="2.0.0"
        />
      );

      const footer = container.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('token count display', () => {
    it('should display token count with formatting', () => {
      render(
        <Footer
          onCopy={() => {}}
          tokenCount={1234}
          tokenLimit={10000}
          version="1.0.0"
        />
      );

      expect(screen.getByText(/1,234/)).toBeInTheDocument();
      expect(screen.getByText(/10,000/)).toBeInTheDocument();
    });

    it('should display zero tokens correctly', () => {
      render(
        <Footer
          onCopy={() => {}}
          tokenCount={0}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      expect(screen.getByText('0 / 1,000 tokens')).toBeInTheDocument();
    });
  });

  describe('status color', () => {
    it('should show green status when under 80% of limit', () => {
      const { container } = render(
        <Footer
          onCopy={() => {}}
          tokenCount={500}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      const statusDot = container.querySelector('.bg-green-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show orange status when at or above 80% of limit', () => {
      const { container } = render(
        <Footer
          onCopy={() => {}}
          tokenCount={800}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      const statusDot = container.querySelector('.bg-orange-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show red status when at or above 100% of limit', () => {
      const { container } = render(
        <Footer
          onCopy={() => {}}
          tokenCount={1000}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      const statusDot = container.querySelector('.bg-red-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show red status when over limit', () => {
      const { container } = render(
        <Footer
          onCopy={() => {}}
          tokenCount={1500}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      const statusDot = container.querySelector('.bg-red-500');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('copy button', () => {
    it('should call onCopy when button is clicked', async () => {
      const onCopy = vi.fn();
      render(
        <Footer
          onCopy={onCopy}
          tokenCount={100}
          tokenLimit={1000}
          version="1.0.0"
        />
      );

      const button = screen.getByRole('button', { name: /copy context/i });
      button.click();

      expect(onCopy).toHaveBeenCalledTimes(1);
    });
  });
});
