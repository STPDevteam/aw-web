import React, {  useState, useEffect } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { GeneralButton } from '@/components'
import { ConnectWallet } from './ConnectWallet'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch } from '@/redux/hooks.js'
import { alertInfoAction, openConnectWalletAction } from '@/redux/reducer/agentReducer.js'
import {  useAccount, } from 'wagmi'
import { MyAgent } from './MyAgent'
import { RandomEncounte } from './RandomEncounte'

export const Nav = () => {
    const canCheckIn = false
    // const [canCheckIn, setCanCheckIn] = useState<any>(false)
    const { address, isConnected } = useAccount()
    const dispatch = useAppDispatch()
    const dailyCheckIn = useMutation(api.wallet.dailyCheckIn)    

    // console.log('address=======', address)
   

    const checkStatus = useQuery(api.wallet.getCheckInStatus,{ walletAddress: address ?? '' })

      
    // console.log('checkStatus', checkStatus)

   


    const worldStatus = useQuery(api.world.defaultWorldStatus)
    const worldId = worldStatus?.worldId   

    // useEffect(() => {   
    //     setCanCheckIn(checkStatus?.canCheckIn || false)
    // }, [checkStatus?.canCheckIn])

    const checkWalletConnected = (cb:() => void) => {
       
        if(isConnected && address) {
            cb()
        }else {
            dispatch(openConnectWalletAction(true))
        }
    }

    const onClaim = () => {
        checkWalletConnected(async() => {
            const a = await dailyCheckIn({ walletAddress: address as `0x${string}` })
            if(a && a.success) {
                dispatch(alertInfoAction({
                    open: true, 
                    title: 'Claim',
                    content: 'Claimed! World points +10'
                }))
               
                // setCanCheckIn(false)
            }
        })
    }    
    
   
    return(
        <Box className='w100' maxW="1720px">
            <Box className='fx-row ai-ct jc-sb w100'>
                <Box className='fx-row ai-ct jc-sb'>
                    <GeneralButton 
                        disable={isConnected ? (!!!canCheckIn) : false}
                        onClick={onClaim}
                        title={isConnected ? ((checkStatus && canCheckIn) ? 'Daily Clock-in' : 'Claimed') : 'Daily Clock-in'}
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
