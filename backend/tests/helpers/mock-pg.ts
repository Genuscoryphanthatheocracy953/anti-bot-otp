import { vi } from 'vitest';

export function createMockPool() {
  return {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  };
}

export type MockPool = ReturnType<typeof createMockPool>;
