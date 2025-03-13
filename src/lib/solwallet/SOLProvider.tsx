import React, { FC, useState } from "react"
import { Web3ReactProvider, initializeConnector, Web3ReactHooks } from '@web3-react/core' 
import { Connector, Web3ReactStore } from '@web3-react/types'
import { Phantom } from 'web3-react-phantom'
import { WalletProvider, ConnectionProvider} from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'


const phantom = initializeConnector<Phantom>((actions) => new Phantom({ actions }))

const allConnections: [Connector, Web3ReactHooks, Web3ReactStore][] = [phantom]

const connections: [Connector, Web3ReactHooks][] = allConnections.map(([connector, hooks]) => [connector, hooks])

const wallets = [
    new PhantomWalletAdapter()
]

export const SOLProvider:FC<{children: React.ReactNode}> = ( { children}) => {
  return (
      <Web3ReactProvider connectors={connections}>
          <ConnectionProvider endpoint={import.meta.env.VITE_HELIUS_RPC}> 
                <WalletProvider wallets={wallets as any} autoConnect>
                  { children }    
                </WalletProvider>
          </ConnectionProvider>
    </Web3ReactProvider>              
  )
}