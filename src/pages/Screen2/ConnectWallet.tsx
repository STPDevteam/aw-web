import React, { FC, useState, useEffect, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClickButtonWrapper, GeneralButton, BasePopup, Notification } from '@/components'
import { Image, Text, Box } from "@chakra-ui/react"
import { ArrowBottom } from '@/images'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, selectOpenConnectWallet } from '@/redux/reducer/agentReducer.js';
import { Logo } from '@/images'


export const ConnectWallet:FC<{ disable?: boolean, points: undefined | number }> = ({ disable, points }) => {
  const [walletOpen, setWalletOpen] = useState(false)
  const { disconnect } = useDisconnect();  
 
  const openConnectWallet = useAppSelector(selectOpenConnectWallet)
  const dispatch = useAppDispatch()
  const openConnectModalRef = useRef<() => void>(() => {})

 const { address, isConnected } = useAccount()



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
                        <GeneralButton size="sm" title="Login" onClick={() => openConnectModal()} />           
                    )
                  }
                  return (
                    <ClickButtonWrapper onClick={() => setWalletOpen(true)}>
                      <Box 
                          h="69px" 
                          w={['150px','150px','150px','200px','323px']}
                          bgColor='#E0E0E0' 
                          className="fx-row ai-ct jc-sb click box_clip" 
                          px={['12px','12px','12px','12px','26px']}
                      >
                          <Text className=" gray3 fw700" fontSize={['16px','16px','16px','20px','26px']}>@{ account?.displayName }</Text>
                          <Image 
                              src={ArrowBottom} 
                              w="19px"
                              h="10px" 
                              transform={ walletOpen ? 'rotate(0deg)' : 'rotate(-180deg)'} 
                              transition="transform 0.3s"
                          />                            
                      </Box>
                    </ClickButtonWrapper>
                  );
                })()}


                <BasePopup
                    visible={walletOpen}
                    onClose={() => setWalletOpen(false)}
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
                      setWalletOpen(false)
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