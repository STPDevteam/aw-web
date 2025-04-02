import React, { FC, useState, useEffect, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClickButtonWrapper, BorderButton, BasePopup, Font16,  } from '@/components'
import { Image, Text, Box, Button } from "@chakra-ui/react"
import { ArrowBottom, Logo } from '@/images'
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, selectOpenConnectWallet } from '@/redux/reducer/agentReducer.js';


interface iConnectWallet {
  points: undefined | number 
  menuOpen: () => void
  closeWalletOpen: () => void
  walletOpen: boolean
  menuIsOpen: boolean
}
export const ConnectWallet:FC<iConnectWallet> = ({ points, menuOpen, walletOpen, closeWalletOpen, menuIsOpen }) => {
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
                      <BorderButton
                        w={180}
                        h={46}
                        title='Login'
                        onClick={openConnectModal}
                      />                       
                    )
                  }
                  return (               
                    <ClickButtonWrapper onClick={menuOpen}>
                      <Box 
                        w={[180]}
                        h={[46]}
                        bgColor='#E0E0E0' 
                        className="fx-row ai-ct jc-sb click box_clip" 
                        boxShadow=" 1px 1px 1px 0px rgba(0, 0, 0, 0.40) inset"
                        px={['12px','12px','12px','12px', '15px']}
                      >
                          <div className='fm2'>
                            <Font16 t={`@${account?.displayName}`} c="#1F1F23"/>
                          </div>
                          <Image 
                              src={ArrowBottom} 
                              h="8px"
                              w="15.2px" 
                              transform={ menuIsOpen ? 'rotate(-180deg)' : 'rotate(0deg)'} 
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
                                <Image src={Logo} w={['60px','60px','60px','70px','80px','90px']} h={['60px','60px','60px','70px','80px','90px']}  borderRadius="50%" />
                                <Text className='gray fm2' fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']} ml="15px">@{`${account?.address.substring(0,4)}...${account?.address.substring(account?.address.length - 4,)}`}</Text>
                            </Box>
                            <Text className="fm2 gray" fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']} mt="30px">World Points: <span className="fw400">{points || '--'}</span></Text>
                            <Box className="box_clip center" mt="10px" w="515px" h="60px" bgColor="#838B8D">
                                <Text color="#293033" fontWeight={350} fontSize={['16px']} className='fm3'>{ account?.address }</Text>
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
        
    );
};