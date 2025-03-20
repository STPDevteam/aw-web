import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import 'uplot/dist/uPlot.min.css';
import 'react-toastify/dist/ReactToastify.css';
import ConvexClientProvider from './components/ConvexClientProvider.tsx';
import { ChakraProvider } from '@chakra-ui/react'
import { Pages } from './pages'

import './styles/animation.css';
import './styles/colors.css';
import './styles/common.css';
import './styles/font.css';
import './styles/override.css';
import './styles/input.css';
import '@rainbow-me/rainbowkit/styles.css';
import { config } from '@/utils/wagmiConfig.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { ReduxProvider } from '@/redux/ReduxProvider'

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReduxProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider >
            <ChakraProvider>
              <ConvexClientProvider>      
                  <Pages />
                </ConvexClientProvider>
              </ChakraProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ReduxProvider>
  </React.StrictMode>
);




