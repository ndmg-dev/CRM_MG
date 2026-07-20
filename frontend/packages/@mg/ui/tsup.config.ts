import { defineConfig } from 'tsup';
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['react', 'react-dom'],
  esbuildPlugins: [vanillaExtractPlugin()],
});
