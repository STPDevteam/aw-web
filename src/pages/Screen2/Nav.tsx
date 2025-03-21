import React, {  useState, useEffect } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { GeneralButton } from '@/components'
import { ConnectWallet } from './ConnectWallet'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch } from '@/redux/hooks.js'
import { alertInfoAction, openConnectWalletAction } from '@/redux/reducer/agentReducer.js'
import {  useAccount, useSignMessage} from 'wagmi'
import { MyAgent } from './MyAgent'
import { RandomEncounte } from './RandomEncounte'

export const Nav = () => {
    const [canCheckIn, setCanCheckIn] = useState<any>(false)
    const { address, isConnected } = useAccount()
    const dispatch = useAppDispatch()
    const dailyCheckIn = useMutation(api.wallet.dailyCheckIn)       
    const checkStatus = useQuery(api.wallet.getCheckInStatus,{ walletAddress: address ?? '' })
      
    // console.log('checkStatus', checkStatus)
    // console.log('canCheckIn', canCheckIn)

    const worldStatus = useQuery(api.world.defaultWorldStatus)
    const worldId = worldStatus?.worldId   

    const { signMessageAsync } = useSignMessage();
    const createChallenge = useMutation(api.wallet.createAuthChallenge);
    const verifySignature = useMutation(api.wallet.verifySignature);

    

    async function signInWithWallet() {
        try {
            if (!isConnected || !address) {
                return
            }
            const { challenge } = await createChallenge({ walletAddress: address })
            const signature = await signMessageAsync({ message: challenge })
            const result = await verifySignature({
                walletAddress: address,
                signature,
            });
            return result
        } catch (error:any) {
            // console.log('errorerror', error)
            if ((error as any).code === 4001 || error?.message?.includes('User rejected')) {
                dispatch(alertInfoAction({
                    open: true,
                    title: 'Warning',
                    content: 'User rejected the request.',
                }))
            }            
            return false
            
        }
    }
      
    useEffect(() => {   
        setCanCheckIn(checkStatus?.canCheckIn || false)
    }, [checkStatus?.canCheckIn])

    const checkWalletConnected = (cb:() => void) => {
        if(isConnected && address) {
            cb()
        }else {
            dispatch(openConnectWalletAction(true))
        }
    }

    const onClaim = () => {
        checkWalletConnected(async() => {
            signInWithWallet().then(async(res: any) => {
                if(res) {
                    const a = await dailyCheckIn({ walletAddress: address as `0x${string}` })
                    if(a && a.success) {
                        dispatch(alertInfoAction({
                            open: true, 
                            title: 'Claim',
                            content: 'Claimed! World points +10'
                        }))
                        setCanCheckIn(false)
                    }
                }
            })

        })
    }    
    
   
    return(
        <Box className='w100' maxW="1720px" >
            <Box className='fx-row ai-ct jc-sb w100'>
                <Box className='fx-row ai-ct jc-sb'>
                    <GeneralButton 
                        disable={isConnected ? (!!!canCheckIn) : false}
                        onClick={onClaim}
                        title={
                            checkStatus === null ? 'Daily Check-in' :
                            (isConnected ? ((checkStatus && canCheckIn) ? 'Daily Check-in' : 'Claimed') : 'Daily Check-in')
                        }
                        size='sm'
                    />
                    <MyAgent worldId={worldId}/>
                    <RandomEncounte worldId={worldId}/>
                </Box>               
                <ConnectWallet points={checkStatus ? checkStatus?.currentPoints : 0}/>    
            </Box>      
            
        </Box>    
    )
}
