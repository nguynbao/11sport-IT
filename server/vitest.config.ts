import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      FORCE_MEMORY_DB: 'true',
    },
  },
});
