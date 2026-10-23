import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock matchMedia for responsive component tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for charts and layout components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback;
  }

  observe(target) {
    this.callback([{ isIntersecting: true, intersectionRatio: 1, target }]);
  }

  unobserve() {}
  disconnect() {}
};

// Suppress console.error in tests unless explicitly tested
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("ReactDOM.render is no longer supported")) {
    return;
  }
  originalError(...args);
};
