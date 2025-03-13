import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'
import path from 'path';

export default defineConfig({
  base: '/ai-town',
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  optimizeDeps: {
    include: ['@chakra-ui/react'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
});

