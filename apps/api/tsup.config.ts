import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    worker: 'src/queue/worker.ts',
    migrate: 'src/db/migrate.ts',
  },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  // Bundle workspace packages so the runner image needs no workspace symlinks
  noExternal: [/^@ai-receptionist\//],
  clean: true,
  splitting: false,
  sourcemap: false,
});
