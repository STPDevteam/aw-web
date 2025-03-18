// import React, { useEffect, useState } from "react"
// import { Flex, Image, Text, Box } from "@chakra-ui/react"
// import {  ClickButtonWrapper, GeneralButton, BasePopup } from '@/components'
// import { useWallet, } from '@solana/wallet-adapter-react'
// import { keepDecimals } from '@/utils/math'
// import { truncateAddress } from '@/utils/tool'
// import { ArrowBottom } from '@/images'


// export const ConnectWallet = () => {
//     const [visible, setVisible] = useState(false)
//     const [isLoading, setLoading] = useState(false)
//     const [walletOpen, setWalletOpen] = useState(false)
    
//     const { publicKey, connect, disconnect, connected, select, signTransaction, signMessage,} = useWallet()  
//     const [isConnected, setConnected] = useState(false)



//     const waleltAddress = publicKey ? publicKey.toBase58() : '--'

//     useEffect(() => {       
//         if(publicKey && publicKey.toBase58()) {
//             const token = localStorage.getItem("token")
//             const address = publicKey.toBase58()
       
//             if(!!!token) {
//                 login(address)
//             }
//         }
//     },[publicKey])


//     const login = async(address: string) => {

       

//     }
    
        
//     const onConnect = async() => {
//         setLoading(true)
//         // @ts-ignore
//         select('Phantom')
//         await connect()
//     }

    
//     const handleSignMessage = async (nonce: string) => {
//         const sourceMsg = `Login request: ${nonce}`
//         const message = new TextEncoder().encode(sourceMsg)
//         let d = { sign: '', msg: '' }
//         try {
//             if(signMessage) {
//                 const signedMessage = await signMessage(message)
//                 const base64Signature = arrayBufferToBase64(signedMessage)               
//                 d.sign = base64Signature
//                 d.msg = sourceMsg              
//             }
//         } catch (err:any) {
//             d.sign = ''
//             d.msg = ''
            
//             setLoading(false)
//             if(`${err}`.indexOf('User rejected the request') > -1) {
       
//             }

//             await disconnect()
//             localStorage.removeItem('token')

//         }
//         return d
//     }

//     const arrayBufferToBase64 = (buffer: Uint8Array) => {
//         return btoa(String.fromCharCode(...buffer))
//     }

//     const shakeAnimation = {
//         '0%': {
//           transform: 'translateX(0px)',
//         },
//         '25%': {
//           transform: 'translateX(-5px)',
//         },
//         '50%': {
//           transform: 'translateX(5px)',
//         },
//         '75%': {
//           transform: 'translateX(-5px)', 
//         },
//         '100%': {
//           transform: 'translateX(0px)',
//         }
//     }


//     const onDisconnect = async() => {
//         await disconnect()
//         localStorage.removeItem('token')
        
//     }

//     return (
//         <Box>
//             <Box className="fx-row ai-ct">
//                 {
//                     waleltAddress && waleltAddress !== '--' ? 
                    // <ClickButtonWrapper onClick={() => setVisible(true)}>
                    //     <Box 
                    //         h="69px" 
                    //         w="323px"
                    //         bgColor='#E0E0E0' 
                    //         className="fx-row ai-ct jc-ct click box_clip " 
                    //         px="26px" 
                    //         onClick={() => setWalletOpen(true)}                            
                    //     >
                    //         <Text className="fz26 gray3 fw700">@{ publicKey && truncateAddress(publicKey.toBase58()) }</Text>
                    //         <Image 
                    //             src={ArrowBottom} 
                    //             w="19px"
                    //             h="10px" 
                    //             transform={ walletOpen ? 'rotate(0deg)' : 'rotate(-180deg)'} 
                    //             transition="transform 0.3s"
                    //         />                            
                    //     </Box>
                    // </ClickButtonWrapper>
//                      : 
//                     <GeneralButton size="sm" title="Login" onClick={onConnect} loading={false}/>
//                 }
              
//             </Box>

            // <BasePopup
            //     visible={walletOpen}
            //     onClose={() => setWalletOpen(false)}
            //     title="Wallet"
            //     content={
            //         <Box mt="30px" mb="150px">
            //             <Box className="fx-row ai-ct">
            //                 <Box w="80px" h="80px" borderRadius="50%" bgColor="white"/>
            //                 <Text className="fz24 gray" ml="24px">{truncateAddress(waleltAddress)}</Text>
            //             </Box>
            //             <Text className="fz24 gray fw700" mt="50px">World Points: <span className="fw400">123</span></Text>
            //             <Box className="box_clip center" mt="10px" w="553px" h="60px" bgColor="#838B8D">
            //                 <Text className="gray2 fz20">{ waleltAddress }</Text>
            //             </Box>
            //         </Box>
            //     }
            //     onOK={onDisconnect}
            //     okText="Disconnect"
            // >
            // </BasePopup>
//         </Box>
//     );
// };


import React, { FC, useState, useEffect, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClickButtonWrapper, GeneralButton, BasePopup, Notification } from '@/components'
import { Image, Text, Box, useAlertStyles } from "@chakra-ui/react"
import { useDisconnect, useConnect } from 'wagmi'
import { ArrowBottom } from '@/images'
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAccount, useSignMessage } from 'wagmi';
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { openConnectWalletAction, selectOpenConnectWallet } from '@/redux/reducer/agentReducer.js';


export const ConnectWallet:FC<{ disable?: boolean }> = ({ disable }) => {
  const [walletOpen, setWalletOpen] = useState(false)
  const [signInfo, setSignInfo] = useState<{open: boolean, msg: string, type: 'success' | 'error' | ''}>({
    open: false,
    msg: '',
    type: ''
  })
  const { disconnect } = useDisconnect();
  
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const createChallenge = useMutation(api.wallet.createAuthChallenge);
  const verifySignature = useMutation(api.wallet.verifySignature);
  const openConnectWallet = useAppSelector(selectOpenConnectWallet)
  const dispatch = useAppDispatch()
  const openConnectModalRef = useRef<() => void>(() => {})
  useEffect(() => {
    const didSignIn = localStorage.getItem('didSignIn')
    if (isConnected && address && !didSignIn) {
      signInWithWallet().then(() => {
        localStorage.setItem('didSignIn', 'true')
      })
    }
    if(!isConnected) {
      localStorage.removeItem('didSignIn')
    }
  }, [isConnected, address])

  useEffect(() => {
    if(openConnectWallet) {
  
      openConnectModalRef.current();
      dispatch(openConnectWalletAction(false))
    }
  },[openConnectWallet])

  async function signInWithWallet() {
    try {
      if (!isConnected || !address) {
        return;
      }
      const { challenge } = await createChallenge({ walletAddress: address });
      const signature = await signMessageAsync({ message: challenge });   
      const result = await verifySignature({
        walletAddress: address,
        signature,
      });
      setSignInfo({
        open: true,
        msg: result.isNewUser ? 'New user signed successfully.' : 'Signed successfully.',
        type: 'success'
      })
      return result;
    } catch (error:any) {
      console.error(error);
    }
  }



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
                          w="323px"
                          bgColor='#E0E0E0' 
                          className="fx-row ai-ct jc-sb click box_clip" 
                          px="26px" 
                      >
                          <Text className="fz26 gray3 fw700">@{ account?.displayName }</Text>
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
                                <Box w="80px" h="80px" borderRadius="50%" bgColor="white"/>
                                <Text className="fz24 gray" ml="24px">123</Text>
                            </Box>
                            <Text className="fz24 gray fw700" mt="50px">World Points: <span className="fw400">123</span></Text>
                            <Box className="box_clip center" mt="10px" w="553px" h="60px" bgColor="#838B8D">
                                <Text className="gray2 fz20">{ account?.address }</Text>
                            </Box>
                        </Box>
                    }
                    onOK={() => {
                      localStorage.removeItem('didSignIn')
                      disconnect()
                    }}
                    okText="Disconnect"
                    >
                </BasePopup>

              </div>
            );
          }}
        </ConnectButton.Custom>
        <Notification
          visible={signInfo.open}
          onClose={() => setSignInfo({
            open: false,
            msg: '',
            type: ''
          })}
          title="Sign info"
          content={signInfo.msg}
          closeOnOverlay
        />
      </Box>
    );
};