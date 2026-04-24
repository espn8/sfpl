import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const memoryStorage = new Map<string, string>();

globalThis.IntersectionObserver = class IntersectionObserverStub {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    queueMicrotask(() => {
      this.callback(
        [
          {
            boundingClientRect: element.getBoundingClientRect(),
            intersectionRatio: 1,
            intersectionRect: element.getBoundingClientRect(),
            isIntersecting: true,
            rootBounds: null,
            target: element,
            time: Date.now(),
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    });
  }

  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [] as IntersectionObserverEntry[];
} as unknown as typeof IntersectionObserver;

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
  },
  writable: true,
});
