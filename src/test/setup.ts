import { vi } from 'vitest';

// jsdom does not implement window.matchMedia. The useMobileDetect hook
// (Phase 35 mobile foundation) reads it during render, so every component
// that consumes it — Modal, UpgradeModal, Layout/Sidebar — would throw
// "matchMedia is not a function" in the test environment without this shim.
//
// Default to matches: false so components render in their DESKTOP
// presentation, matching the assumptions baked into the existing suite.
// A test that needs mobile can override window.matchMedia per-case.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated, kept for type completeness
      removeListener: vi.fn(), // deprecated, kept for type completeness
      dispatchEvent: vi.fn(() => false),
    }) as unknown as MediaQueryList;
}
