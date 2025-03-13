import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  mainnet,
} from 'wagmi/chains';

const isProd = false
export const config = getDefaultConfig({
  appName: isProd ? 'World Fun' : 'World Fun',
  projectId: isProd ? '5092396aec29e582c1c069ebbf0634d0' : '465d6f4e7a0f145593ef53424e67c2f4', 
  chains: [
    mainnet,
  ],
});
