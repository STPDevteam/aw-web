import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    walletConnect({ projectId: '4ceb2417719c385360361ed2565effe3' }),
    // metaMask(),
    safe(),
  ],
  transports: {
    [base.id]: http(),
  },
})
