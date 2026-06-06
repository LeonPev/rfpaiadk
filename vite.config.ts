import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hasGeminiKey = Boolean(env.GOOGLE_API_KEY || env.GEMINI_API_KEY);

  return {
    plugins: [react()],
    define: {
      __AYIT_HAS_GEMINI_KEY__: JSON.stringify(hasGeminiKey),
    },
    server: {
      port: 5173,
      proxy: {
        '/adk': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/adk/, ''),
        },
      },
    },
  };
});
