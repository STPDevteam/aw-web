import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'
import { switchChain } from '@wagmi/core'

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


export const autoSwitchChain = async() => {
  await switchChain(config, { chainId: base.id })
  // if(a && a.id) {
  //   return a.id
  // }
  // return 1
}

export const isBaseChain = (cId: number | undefined) => {
    return cId  === base.id
}