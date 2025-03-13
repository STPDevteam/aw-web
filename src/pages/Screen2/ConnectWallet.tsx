import React, { useEffect, useState } from "react"
import { Flex, Image, Text, Box } from "@chakra-ui/react"
import {  ClickButtonWrapper, GeneralButton, BasePopup } from '@/components'
// import { CopyImg, WalletImg, XImg, XHoverImg, ArrowImg, ArrowLeftImg } from "@/assets/images"
// import { connectWalletApi, generateNonceApi } from '@/api'
import { useWallet, } from '@solana/wallet-adapter-react'
// import { Connection, PublicKey } from "@solana/web3.js"
import { keepDecimals } from '@/utils/math'
// import { useAppDispatch, useAppSelector } from "@/redux/hooks"
// import { notificationInfoAction, refreshBalanceAction, selectWalletInfo, walletInfoAction } from "@/redux/reducer"
import { truncateAddress } from '@/utils/tool'
import { ArrowBottom } from '@/images'


export const ConnectWallet = () => {
    const [visible, setVisible] = useState(false)
    const [isLoading, setLoading] = useState(false)
    const [walletOpen, setWalletOpen] = useState(false)
    
    const { publicKey, connect, disconnect, connected, select, signTransaction, signMessage,} = useWallet()  
    const [isConnected, setConnected] = useState(false)
    // const { isConnected, balance} = useAppSelector(selectWalletInfo)
  
    // const dispatch = useAppDispatch()


    const waleltAddress = publicKey ? publicKey.toBase58() : '--'

    useEffect(() => {       
        if(publicKey && publicKey.toBase58()) {
            const token = localStorage.getItem("token")
            const address = publicKey.toBase58()
            // dispatch(walletInfoAction({ address: address }))
            // dispatch(refreshBalanceAction(true))        
            if(!!!token) {
                login(address)
            }
        }
    },[publicKey])


    const login = async(address: string) => {

        // setLoading(true)
        // const res = await generateNonceApi()        
        // if(res && res.nonce) {
        //     const { sign, msg } = await handleSignMessage(res.nonce)
        //     if(sign && msg) {
        //         const { message, user, access_token, refresh_token } = await connectWalletApi(address, msg, sign)
        //         setLoading(false)
        //         if(message === "User connected") {
        //             // dispatch(walletInfoAction({ isConnected: true }))
        //             localStorage.setItem('token', access_token)
        //             localStorage.setItem('refresh_token', refresh_token)
        //         }
        //     }
        // }

    }
    
        
    const onConnect = async() => {
        setLoading(true)
        // @ts-ignore
        select('Phantom')
        await connect()
    }

    
    const handleSignMessage = async (nonce: string) => {
        const sourceMsg = `Login request: ${nonce}`
        const message = new TextEncoder().encode(sourceMsg)
        let d = { sign: '', msg: '' }
        try {
            if(signMessage) {
                const signedMessage = await signMessage(message)
                const base64Signature = arrayBufferToBase64(signedMessage)               
                d.sign = base64Signature
                d.msg = sourceMsg              
            }
        } catch (err:any) {
            d.sign = ''
            d.msg = ''
            
            setLoading(false)
            if(`${err}`.indexOf('User rejected the request') > -1) {
                // dispatch(notificationInfoAction({
                //     open: true,
                //     title: 'user rejected the request'
                // }))
            }

            await disconnect()
            localStorage.removeItem('token')
            // dispatch(walletInfoAction({ isConnected: false, address: '', balance: 0 }))

        }
        return d
    }

    const arrayBufferToBase64 = (buffer: Uint8Array) => {
        return btoa(String.fromCharCode(...buffer))
    }

    const shakeAnimation = {
        '0%': {
          transform: 'translateX(0px)',
        },
        '25%': {
          transform: 'translateX(-5px)',
        },
        '50%': {
          transform: 'translateX(5px)',
        },
        '75%': {
          transform: 'translateX(-5px)', 
        },
        '100%': {
          transform: 'translateX(0px)',
        }
    }


    const onDisconnect = async() => {
        await disconnect()
        localStorage.removeItem('token')
        // dispatch(walletInfoAction({ isConnected: false, address: '', balance: 0 }))
        // onClose()
    }

    return (
        <Box>
            <Box className="fx-row ai-ct">
                {
                    waleltAddress && waleltAddress !== '--' ? 
                    <ClickButtonWrapper onClick={() => setVisible(true)}>
                        <Box 
                            h="69px" 
                            w="323px"
                            bgColor='#E0E0E0' 
                            className="fx-row ai-ct jc-ct click box_clip " 
                            px="26px" 
                            onClick={() => setWalletOpen(true)}                            
                        >
                            <Text className="fz26 gray3 fw700">@{ publicKey && truncateAddress(publicKey.toBase58()) }</Text>
                            <Image 
                                src={ArrowBottom} 
                                w="19px"
                                h="10px" 
                                transform={ walletOpen ? 'rotate(0deg)' : 'rotate(-180deg)'} 
                                transition="transform 0.3s"
                            />                            
                        </Box>
                    </ClickButtonWrapper>
                     : 
                    <GeneralButton size="sm" title="Login" onClick={onConnect} loading={false}/>
                }
              
            </Box>

            <BasePopup
                visible={walletOpen}
                onClose={() => setWalletOpen(false)}
                title="Wallet"
                content={
                    <Box mt="30px" mb="150px">
                        <Box className="fx-row ai-ct">
                            <Box w="80px" h="80px" borderRadius="50%" bgColor="white"/>
                            <Text className="fz24 gray" ml="24px">{truncateAddress(waleltAddress)}</Text>
                        </Box>
                        <Text className="fz24 gray fw700" mt="50px">World Points: <span className="fw400">123</span></Text>
                        <Box className="box_clip center" mt="10px" w="553px" h="60px" bgColor="#838B8D">
                            <Text className="gray2 fz20">{ waleltAddress }</Text>
                        </Box>
                    </Box>
                }
                onOK={onDisconnect}
                okText="Disconnect"
            >
            </BasePopup>
        </Box>
    );
};
