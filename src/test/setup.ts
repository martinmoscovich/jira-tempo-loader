import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Node 20+ exposes globalThis.crypto as a getter-only property, so plain assignment throws.
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: {
  randomUUID: () => Math.random().toString(36).substring(2, 15),
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {
    digest: async (_algorithm: string, _data: ArrayBuffer) => {
      return new ArrayBuffer(32);
    },
  } as SubtleCrypto,
  } as Crypto,
});
