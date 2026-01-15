import '@testing-library/jest-dom';

// Mock Tauri API for tests
global.window = Object.create(window);
const mockInvoke = vi.fn();

Object.defineProperty(window, '__TAURI__', {
  value: {
    core: {
      invoke: mockInvoke,
    },
  },
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockClear();
});

export { mockInvoke };
