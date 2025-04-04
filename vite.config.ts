import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'
import path from 'path';



export default defineConfig(({ mode }) => {
  return {
    server: {
      hmr: mode === 'development',
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    // for dev
    define: mode === 'production'
    ? {
        __HMR_CONFIG_NAME__: JSON.stringify(""),
      }
    : {},

    // for prod
    // define: {
    //   __HMR_CONFIG_NAME__: JSON.stringify(mode === 'development' ? "dev-hmr-config" : ""),
    // },
    plugins: [react()],

    optimizeDeps: {
      include: ['@chakra-ui/react'],
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

  };
});