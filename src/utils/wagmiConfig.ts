import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {  
  base,
} from 'wagmi/chains';

const isProd = false
export const config = getDefaultConfig({
  appName: 'World Fun',
  projectId: '5092396aec29e582c1c069ebbf0634d0', 
  chains: [
    base,
  ],
});
