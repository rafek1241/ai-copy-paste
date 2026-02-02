import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri API for tests
const mockInvoke = vi.fn();
const mockListen = vi.fn().mockResolvedValue(() => {});
const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
}));

// Fallback for window.__TAURI__ for components using it directly
Object.defineProperty(window, '__TAURI__', {
  value: {
    core: {
      invoke: mockInvoke,
    },
    event: {
      listen: mockListen,
      emit: mockEmit,
    }
  },
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockClear();
  mockListen.mockClear();
  mockEmit.mockClear();
  
  // Mock window methods that are not in jsdom
  window.alert = vi.fn();
  window.confirm = vi.fn().mockReturnValue(true);
});

export { mockInvoke, mockListen, mockEmit };

// Mock the toast hook
const mockToast = {
  toast: vi.fn(),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  ToastViewport: () => null,
  Toast: () => null,
  ToastTitle: () => null,
  ToastDescription: () => null,
  ToastClose: () => null,
  ToastAction: () => null,
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});
