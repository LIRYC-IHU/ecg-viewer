/**
 * Build of the Girder 5 plugin's web client (`girder-plugin/`).
 *
 * Girder loads plugin bundles as classic <script> tags after its own client,
 * so this is a single self-contained UMD file: React, the viewer and the
 * DICOM parser are all bundled in. The output lands inside the Python
 * package, which ships it as package data.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webClient = path.resolve(__dirname, 'girder-plugin/girder_ecg_viewer/web_client');

export default defineConfig({
  plugins: [react()],
  // Library mode leaves `process.env.NODE_ENV` alone; React needs it resolved
  // (and its production build) in a browser bundle.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: path.join(webClient, 'dist'),
    emptyOutDir: true,
    sourcemap: !process.env.SKIP_SOURCE_MAPS,
    lib: {
      entry: path.join(webClient, 'main.tsx'),
      name: 'GirderPluginEcgViewer',
      formats: ['umd'],
      fileName: () => 'girder-plugin-ecg-viewer.umd.cjs',
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.names?.[0]?.endsWith('.css') ? 'style.css' : (asset.names?.[0] ?? '[name][extname]'),
      },
    },
  },
});
