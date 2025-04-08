import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'
import path from 'path';


function myHmrPlugin() {
  return {
    name: 'disable-refresh-on-disconnect',
    configureServer(server:any) {
      server.ws.on('vite:ws:disconnect', () => {
        console.log('WebSocket disconnect intercepted. Implement custom reconnect logic here.')
      })
    },
  }
}



export default defineConfig(({ mode }) => {
  return {
    server: {
      hmr: mode === 'development',
      overlay: false,
      allowedHosts: ['localhost', '127.0.0.1','ai-town-lb-1479478427.ap-northeast-1.elb.amazonaws.com','world.fun','www.world.fun','test.world.fun'],
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
    plugins: [
      react(),
      myHmrPlugin()
    ],

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