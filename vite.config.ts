import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          dashboard: path.resolve(__dirname, 'assets/pages/dashboard/index.html'),
          form: path.resolve(__dirname, 'assets/pages/form/index.html'),
          grades: path.resolve(__dirname, 'assets/pages/grades/index.html'),
          import: path.resolve(__dirname, 'assets/pages/import/index.html'),
          login: path.resolve(__dirname, 'assets/pages/login/index.html'),
          ozelEgitim: path.resolve(__dirname, 'assets/pages/ozel-egitim/index.html'),
          riba: path.resolve(__dirname, 'assets/pages/riba/index.html'),
          ribaRapor: path.resolve(__dirname, 'assets/pages/riba-rapor/index.html'),
        },
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
