import React, { FC, useState, useEffect, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClickButtonWrapper, SvgButton, BasePopup, Notification } from '@/components'
import { Image, Text, Box } from "@chakra-ui/react"
import { ArrowBottom } from '@/images'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, selectOpenConnectWallet } from '@/redux/reducer/agentReducer.js';
import { Logo } from '@/images'


interface iConnectWallet {
  points: undefined | number 
  menuOpen: (v: boolean) => void
  closeWalletOpen: () => void
  walletOpen: boolean
}
export const ConnectWallet:FC<iConnectWallet> = ({ points, menuOpen, walletOpen, closeWalletOpen }) => {
  const { disconnect } = useDisconnect()
 
  const openConnectWallet = useAppSelector(selectOpenConnectWallet)
  const dispatch = useAppDispatch()
  const openConnectModalRef = useRef<() => void>(() => {})

  useEffect(() => {
    if(openConnectWallet) {
  
      openConnectModalRef.current();
      dispatch(openConnectWalletAction(false))
    }
  },[openConnectWallet])




    return (
      <Box>
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            openConnectModalRef.current = openConnectModal
            const ready = mounted 
            const connected = ready && account && chain
            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                        <SvgButton
                          onClick={openConnectModal}
                          name='Login'
                          w={[180]}
                          h={[46]}
                      />  
                    )
                  }
                  return (                   
                    <ClickButtonWrapper onClick={() => menuOpen(true)}>
                      <Box 
                        w={[180]}
                        h={[46]}
                        bgColor='#E0E0E0' 
                        className="fx-row ai-ct jc-sb click box_clip15" 
                        boxShadow=" 1px 1px 1px 0px rgba(0, 0, 0, 0.40) inset"
                        px={['12px','12px','12px','15px','15px']}
                      >
                          <Text className=" " fontWeight={350}  color="#1F1F23" fontSize={['14px','14px','14px','14px','16px']}>@{ account?.displayName }</Text>
                          <Image 
                              src={ArrowBottom} 
                              h="8px"
                              w="15.2px" 
                              transform={ walletOpen ? 'rotate(0deg)' : 'rotate(-180deg)'} 
                              transition="transform 0.3s"
                          />                            
                      </Box>
                    </ClickButtonWrapper>
                  );
                })()}                

                <BasePopup
                    visible={walletOpen}
                    onClose={closeWalletOpen}
                    title="Wallet"
                    content={
                        <Box mt="30px" mb="150px">
                            <Box className="fx-row ai-ct">
                                <Image src={Logo} w="80px" h="80px" borderRadius="50%" />
                                <Text className="fz24 gray" ml="24px">@{`${account?.address.substring(0,4)}...${account?.address.substring(account?.address.length - 4,)}`}</Text>
                            </Box>
                            <Text className="fz24 gray fw700" mt="50px">World Points: <span className="fw400">{points || '--'}</span></Text>
                            <Box className="box_clip center" mt="10px" w="553px" h="60px" bgColor="#838B8D">
                                <Text className="gray2 fz20">{ account?.address }</Text>
                            </Box>
                        </Box>
                    }
                    onOK={() => {
                      localStorage.removeItem('didSignIn')
                      disconnect()
                      closeWalletOpen()
                    }}
                    okText="Disconnect"
                    >
                </BasePopup>

              </div>
            );
          }}
        </ConnectButton.Custom>
          
       

      </Box>
    );
};