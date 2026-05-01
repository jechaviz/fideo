import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              const pkg = (name: string) => new RegExp(`[\\\\/]node_modules[\\\\/]${name}[\\\\/]`).test(id);

              if (
                pkg('recharts') ||
                pkg('victory-vendor') ||
                pkg('react-redux') ||
                pkg('@reduxjs') ||
                pkg('immer') ||
                pkg('reselect')
              ) {
                return 'charts';
              }

              if (pkg('@google/genai') || pkg('protobufjs') || pkg('p-retry')) {
                return 'ai';
              }

              if (pkg('pocketbase')) {
                return 'pocketbase';
              }

              if (pkg('react') || pkg('react-dom') || pkg('scheduler')) {
                return 'react-vendor';
              }

              if (id.includes('node_modules')) {
                return 'vendor';
              }
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
