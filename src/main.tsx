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
import { SOLProvider } from '@/lib/solwallet/SOLProvider.tsx'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider >
     
          <ConvexClientProvider>
             <SOLProvider>
            <Pages />
            </SOLProvider>
          </ConvexClientProvider>
    </ChakraProvider>
  </React.StrictMode>,
);



