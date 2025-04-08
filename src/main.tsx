import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import 'uplot/dist/uPlot.min.css';
import 'react-toastify/dist/ReactToastify.css';
import ConvexClientProvider from './components/ConvexClientProvider.tsx';
import { ChakraProvider } from '@chakra-ui/react'
import { IframeScreen } from './pages/IframeScreen'

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
import { base } from 'wagmi/chains'
import { LoadingPortal } from '@/components/LoadingPortal'

const queryClient = new QueryClient();



const MainApp = () => (
  <React.StrictMode>
    <ReduxProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider initialChain={base}>
            <ChakraProvider>
              <ConvexClientProvider>      
                  <IframeScreen />
                </ConvexClientProvider>
              </ChakraProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ReduxProvider>
    <LoadingPortal/>
  </React.StrictMode>
)


ReactDOM.createRoot(document.getElementById('root')!).render(<MainApp/>)


setTimeout(() => {
  const loader = document.getElementById('initial-loading')
  if (loader) {
    loader.style.display = 'none'
  }
}, 3000)
